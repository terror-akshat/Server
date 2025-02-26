const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "https://charming-chebakia-38d373.netlify.app",
        methods: ["GET", "POST"],
    },
});

app.use(cors());

const PORT = process.env.PORT || 9000;

// Track active rooms and participants
const activeRooms = new Map();

app.get("/", (req, res) => {
    res.send("Server is running");
});

io.on("connection", (socket) => {
    socket.emit("me", socket.id);

    socket.on("callUser", ({ userToCall, signalData, from, name, roomId }) => {
        if (!activeRooms.has(roomId)) {
            activeRooms.set(roomId, new Set([from, userToCall]));
        }
        socket.join(roomId);

        io.to(userToCall).emit("callUser", {
            signal: signalData,
            from,
            name,
            roomId,
        });
    });

    socket.on("answerCall", (data) => {
        const { to, roomId } = data;
        socket.join(roomId);

        if (activeRooms.has(roomId)) {
            activeRooms.get(roomId).add(socket.id);
        }

        io.to(to).emit("callAccepted", data.signal);
    });

    // Whiteboard Drawing Event
    socket.on("draw", (data) => {
        const { roomId, ...drawingData } = data;
        if (roomId && activeRooms.has(roomId)) {
            socket.to(roomId).emit("draw", drawingData);
        }
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
        activeRooms.forEach((participants, roomId) => {
            if (participants.has(socket.id)) {
                participants.delete(socket.id);
                if (participants.size === 0) {
                    activeRooms.delete(roomId);
                }
            }
        });
        socket.broadcast.emit("callEnded");
    });
});

server.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
