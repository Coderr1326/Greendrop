const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

// Initialize app
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: 'http://localhost:5500', credentials: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Connect to MongoDB
mongoose.connect('mongodb+srv://greedrop:frdmJ0bbSQ2jjjdV@cluster0.6yfky.mongodb.net/', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

// User Schema
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String
});

// Post Schema
const postSchema = new mongoose.Schema({
    content: String,
    author: String,
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    comments: [{ author: String, text: String }],
    usersVoted: [String]
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

// Register Route
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
});

// Login Route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create JWT Token
    const token = jwt.sign({ userId: user._id }, 'your_jwt_secret', { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });

    res.json({ message: "Login successful" });
});

// Auth Middleware
const auth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, 'your_jwt_secret');
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid token" });
    }
};

// Create Post Route (Protected)
app.post('/posts', auth, async (req, res) => {
    const { content } = req.body;
    const user = await User.findById(req.userId);

    const post = new Post({ content, author: user.username });
    await post.save();

    res.status(201).json(post);
});

// Get All Posts
app.get('/posts', async (req, res) => {
    const posts = await Post.find();
    res.json(posts);
});


// Add Comment to Post (Protected)
app.post('/posts/:id/comments', auth, async (req, res) => {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);
    const user = await User.findById(req.userId);

    post.comments.push({ author: user.username, text });
    await post.save();

    res.json(post);
});
app.post('/posts/:id/vote', auth, async (req, res) => {
    const { voteType } = req.body;
    const post = await Post.findById(req.params.id);
    const user = await User.findById(req.userId);

    if (post.usersVoted.includes(user.username)) {
        return res.status(400).json({ message: "User has already voted" });
    }

    if (voteType === 'upvote') {
        post.upvotes += 1;
    } else if (voteType === 'downvote') {
        post.downvotes += 1;
    }

    post.usersVoted.push(user.username);
    await post.save();

    res.json({ message: "Vote registered" });
});

// Upvote/Downvote Post (Protected)
app.post('/posts/:id/vote', auth, async (req, res) => {
    const { voteType } = req.body;
    const post = await Post.findById(req.params.id);
    const user = await User.findById(req.userId);

    if (post.usersVoted.includes(user.username)) {
        return res.status(400).json({ message: "User has already voted" });
    }

    if (voteType === 'upvote') {
        post.upvotes += 1;
    } else if (voteType === 'downvote') {
        post.downvotes += 1;
    }

    post.usersVoted.push(user.username);
    await post.save();

    res.json(post);
});

// Logout Route
app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: "Logged out successfully" });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
