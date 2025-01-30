require('dotenv').config(); // Load environment variables at the start

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // Secure password storage

const app = express();
const port = 4000;

app.use(express.json());
// app.use(cors());

// app.use(cors({
//   origin: ['https://ecomm-frontend-beryl.vercel.app', 'https://ecomm-admin-lime.vercel.app'], // Allow frontend and admin URLs
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   credentials: true,
// }));



// List of allowed origins (both admin and frontend URLs)
const allowedOrigins = [
  'http://localhost:5173',  // Admin page during development
  'http://localhost:3000',  // Frontend page during development
  'https://ecomm-admin-lime.vercel.app',  // Deployed admin URL
  'https://ecomm-frontend-beryl.vercel.app',  // Deployed frontend URL
];

// CORS middleware setup to allow multiple origins
app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      // Allow the request if the origin is in the allowed list, or no origin (for Postman/CLI requests)
      callback(null, true);
    } else {
      // Reject requests from unknown origins
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST','PUT', 'DELETE'],  // Allow specific HTTP methods if needed
  credentials: true,  // Allow cookies if needed
}));

const baseUrl = process.env.BASE_URL;
console.log("baseUrl:", baseUrl);
// ✅ Database Connection
const connectDatabase = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to database');
    } catch (err) {
        console.error('Database connection error:', err);
    }
};
connectDatabase();

// ✅ Image Storage Engine
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

app.use('/images', express.static('upload/images')); // Serve static images

// ✅ Image Upload Endpoint (Fixing `undefined` issue)
app.post("/upload", upload.single('product'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: 0, message: "No file uploaded" });
    }
    res.json({
        success: 1,
        image_url: `${baseUrl}/images/${req.file.filename}`
    });
});

// ✅ Product Schema
const Product = mongoose.model("Product", {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    category: { type: String, required: true },
    new_price: { type: Number, required: true },
    old_price: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    available: { type: Boolean, default: true }
});

// ✅ Add Product API
app.post('/addproduct', async (req, res) => {
    let products = await Product.find({});
    let id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

    const product = new Product({ id, ...req.body });

    await product.save();
    res.json({ success: true, name: req.body.name });
});

// ✅ Remove Product API
app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    res.json({ success: true, name: req.body.name });
});

// ✅ Get All Products API
app.get('/allproducts', async (req, res) => {
    let products = await Product.find({});
    res.send(products);
});

// ✅ User Schema
const User = mongoose.model('User', {
    name: { type: String },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    cartData: { type: Object, default: {} },
    date: { type: Date, default: Date.now }
});

// ✅ Sign Up API (Now with **password hashing**)
app.post('/signup', async (req, res) => {
    let existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
        return res.status(400).json({ success: false, errors: "User with this email already exists" });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0;
    }

    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword, // Store hashed password
        cartData: cart
    });

    await user.save();

    const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ success: true, token });
});

// ✅ Login API (Now with **password verification**)
app.post('/login', async (req, res) => {
    let user = await User.findOne({ email: req.body.email });

    if (!user) return res.status(400).json({ success: false, errors: "Invalid Email or Password" });

    const isMatch = await bcrypt.compare(req.body.password, user.password);

    if (!isMatch) return res.status(400).json({ success: false, errors: "Invalid Email or Password" });

    const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ success: true, token });
});

// ✅ Middleware for Authentication
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) return res.status(401).json({ errors: "Please authenticate using a valid token" });

    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.user = data.user;
        next();
    } catch {
        res.status(401).json({ errors: "Invalid Token" });
    }
};

// ✅ Add to Cart API
app.post('/addtocart', fetchUser, async (req, res) => {
    let userData = await User.findById(req.user.id);
    userData.cartData[req.body.itemId] += 1;
    await userData.save();
    res.send("Added");
});

// ✅ Remove from Cart API
app.post('/removefromcart', fetchUser, async (req, res) => {
    let userData = await User.findById(req.user.id);
    if (userData.cartData[req.body.itemId] > 0) {
        userData.cartData[req.body.itemId] -= 1;
    }
    await userData.save();
    res.send("Removed");
});

// ✅ Get Cart Data API
app.get('/getcart', fetchUser, async (req, res) => {
    let userData = await User.findById(req.user.id);
    res.json(userData.cartData);
});

// ✅ New Collections API
app.get('/newcollections', async (req, res) => {
    let products = await Product.find({});
    res.send(products.slice(-8));
});

// ✅ Popular in Women API
app.get('/popularinwomen', async (req, res) => {
    let products = await Product.find({ category: "women" });
    res.send(products.slice(0, 4));
});

// ✅ Start Server
app.listen(port, () => console.log(`Server running on port ${port}`));
