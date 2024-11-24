// Here we install express for backend, jsonwebtoken for user authentication , mongoose for database, multer to store images that are upload using
//  admin panel,cors -using this we can add permission to our application to access backend

const port = 4000;
const express = require('express');
const app = express(); //initializes the express application
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken')
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const dotenv=require('dotenv');
app.use(express.json()); //converted from a (JSON string) into a (JavaScript object) that your server can work with. express.json() is a middleware 
// Middleware in Express is a function that processes requests before they reach the route handlers.
//  express.json() runs for every incoming request that has a Content-Type of application/json.
// If the incoming JSON is:
// { "name": "John", "age": 30 }
// Then req.body will be:
// {name: "John",age: 30}
app.use(cors());  //Enables Cross-Origin Resource Sharing (CORS), allowing the server to handle requests from different origins.
dotenv.config();
// Database connection with mongodb 
// mongoose.connect("mongodb+srv://dumpareethika:kVX3uqQ3twFuJ7Tj@cluster0.v70my.mongodb.net/e-commerce");
const connectdatabase = async()=>{
    try{
      const DB_URL = process.env.DB_URL
      await mongoose.connect(DB_URL);
      console.log('connected to database')
    }
    catch(err)
    {
        console.log(err)
    }
}
connectdatabase();



//API creation

app.get("/", (req, res) => {
    res.send("Express App is running");
})

//Image storage Engine
//middleware

//multer.diskStorage: Defines where and how the images will be stored.
// destination: Specifies the folder where images will be saved (./upload/images).
// filename: Determines the filename of the saved image, which includes the original field name,
//  the current timestamp, and the original file extension.
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname} ${Date.now()} ${path.extname(file.originalname)}`)
    }
})

const upload = multer({ storage: storage })

//creating upload endpoint for images
app.use('/images', express.static('upload/images'))  // /image is an static endpoint

app.post("/upload", upload.single('product'), (req, res) => { // /upload is another endpoint
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})

//Schema for creating products

const Product = mongoose.model("product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    new_price: {
        type: Number,
        required: true
    },
    old_price: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true
    }
})

//creating an API to add an product
app.post('/addproduct', async (req, res) => {
    let products = await Product.find({});
    let id;
    if (products.length > 0) {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id + 1;
    }
    else {
        id = 1;
    }
    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });
    console.log(product);
    await product.save(); //save the product in database
    console.log("saved"); //generating a response 
    res.json({
        success: true,
        name: req.body.name,
    })
})

//creating API for deleting products
app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("removed");
    res.json({
        success: true,
        name: req.body.name,
    })
})

//creating API for getting all products
app.get('/allproducts', async (req, res) => {
    let products = await Product.find({});
    console.log("all products fetched");
    res.send(products);
})

//Schema creating for user model

const Users = mongoose.model('Users', {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
        required: true
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now,
    }
})

//Creating endpoint for registering the user
app.post('/signup', async (req, res) => {
    let check = await Users.findOne({ email: req.body.email });
    if (check) {
        return res.status(400).json({ success: false, errors: "existing user found with same email id" })
    }
    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0;
    }
    const user = new Users({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    })
    await user.save();
    const data = {
        user: {
            id: user.id
        }
    }
    const token = jwt.sign(data, 'secret_ecom');
    res.json({ success: true, token })
})

//creating endpoint for user login
app.post('/login', async (req, res) => {
    let user = await Users.findOne({ email: req.body.email });
    if (user) {
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = {
                user: {
                    id: user.id
                }
            };
            const token = jwt.sign(data, 'secret_ecom');
            res.json({ success: true, token });
        } else {
            res.json({ success: false, errors: "Wrong Password" });
        }
    }
    else {
        res.json({ success: false, errors: "Wrong email id" });
    }
});


//creating endpoint for new collection data
app.get('/newcollections',async (req,res)=>{
   let products=await Product.find({});
   let newcollection=products.slice(1).slice(-8);
   console.log("NewCollection fetched");
   res.send(newcollection);
})

//creating endpoint for popular in women section
app.get('/popularinwomen',async(req,res)=>{
    let products=await Product.find({category:"women"});
    let popular_in_women=products.slice(0,4);
    console.log("Popular in women fetched");
    res.send(popular_in_women);
})

//creating middleware to fetch user
const fetchUser=async(req,res,next)=>{
    const token =req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"Please authenticate using valid token"});
    }
    else{
        try{
           const data=jwt.verify(token,'secret_ecom');
           req.user=data.user;
           next();
        }
        catch(error){
          res.status(401).send({errors:"Please authenticate using a valid token"});
        }
    }
}

//creating endpoint for adding products in cartdata.Its for user personally
app.post('/addtocart',fetchUser,async(req,res)=>{
//    console.log(req.body,req.user);
console.log("Added",req.body.itemId);
let userData=await Users.findOne({_id:req.user.id});
userData.cartData[req.body.itemId]+=1;
await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
res.send("Added");
})


//creating an endpoint to remove a product from cart data .Its for user personally
app.post('/removefromcart',fetchUser,async(req,res)=>{
    console.log("removed",req.body.itemId);
    let userData=await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0){
userData.cartData[req.body.itemId]-=1;
    }
await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
res.send("Removed");
})

//creating an endpoint to get cart data
app.post('/getcart',fetchUser,async(req,res)=>{
    console.log("Get Cart");
    let userData=await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

app.listen(port, (error) => {
    if (!error) {
        console.log("Server Running on port " + port)
    }
    else {
        console.log("Error: " + error)
    }
})

