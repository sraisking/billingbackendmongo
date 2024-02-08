const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Pet = require("./models/PetSchema");
const app = express();
const cors = require("cors"); // Add this line
const fs = require('fs');
require('dotenv').config();
const port = process.env.PORT || 3000;
const mongoUri = "mongodb+srv://shah:shah@cluster0.pcdrbds.mongodb.net/pets";
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
mongoose
  .connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDb Connected"))
  .catch((err) => console.error(err));

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

// Hash and salt the password before saving
UserSchema.pre("save", async function (next) {
  const user = this;

  if (user.isModified("password")) {
    const saltRounds = 10;
    user.password = await bcrypt.hash(user.password, saltRounds);
  }

  next();
});

const User = mongoose.model("User", UserSchema);
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(cors());
const authenticateJWT = (req, res, next) => {
  const token = req.header("Authorization").split(' ')[1];
  console.log("Received Token:", token);
  if (!token) {
    return res.status(401).send({ message: "Token is missing" });
  }

  jwt.verify(token, "ycf", (err, user) => {
    if (err) {
      console.error("Token verification error:", err);
      return res.status(403).send({ message: "Invalid token" });
    }

    req.user = user;
    next();
  });
};

app.post("/signup", async (req, res) => {
  console.log(req.body);
  const { username, password } = req.body;
  try {
    // Check if the username is already taken
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).send({ message: "Username is already taken" });
    }

    // Hash and salt the password before saving
    // const saltRounds = 10;
    if (!password) {
      return res.status(400).send({ message: "Password is required" });
    }
    
    // const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create a new user with the hashed password
    const newUser = new User({ username, password });

    await newUser.save();
    res.status(201).send({ message: "User created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the user by username
    const user = await User.findOne({ username });

    if (!user) {
      console.log("User not found:", username);
      return res.status(401).send({ message: "Invalid credentials" });
    }

    console.log("Found user:", user);
    console.log("Entered password:", password);
    console.log("Hashed entered password:", await bcrypt.hash(password, 10));
    // Compare entered password with stored hashed password
    const isPasswordValid = await bcrypt.compare(password.trim(), user.password.trim());

    console.log("Password validation result:", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).send({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ username }, 'ycf', {
      expiresIn: "1h",
      algorithm: "HS256", // Specify the algorithm explicitly
    });

    res.json({ token });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});


app.get("/pets", authenticateJWT, async (req, res) => {
  try {
    const pets = await Pet.find();
    res.send(pets);
  } catch (error) {
    res.status(500).send(error);
  }
});
app.get("/pets/:id", authenticateJWT, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      return res.status(404).send({ message: "Pet not found" });
    }
    res.send(pet);
  } catch (error) {
    res.status(500).send(error);
  }
});
app.post(
  "/pets",
  authenticateJWT,
  upload.single("picture"),
  async (req, res) => {
    console.log(req.body);
    try {
      const expenses = JSON.parse(req.body.expenses);
      const pet = new Pet({
        ...req.body,
        expenses: expenses,
        picture: {
          data: fs.readFileSync(req.file.path), // Read the file buffer
          contentType: req.file.mimetype // Store the content type
        },
      });

      await pet.save();
      res.status(201).send(pet);
    } catch (error) {
      console.log(error);
      res.status(400).send(error);
    }
  }
);
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
