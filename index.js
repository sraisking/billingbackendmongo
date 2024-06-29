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
const fs = require("fs");
const PDFDocument = require("pdfkit");
require("dotenv").config();
const port = process.env.PORT || 3000;
const mongoUri = "mongodb+srv://shah:shah@cluster0.pcdrbds.mongodb.net/pets";
const uploadsDir = path.join(__dirname, "uploads");
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
  const token = req.header("Authorization").split(" ")[1];
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
    const isPasswordValid = await bcrypt.compare(
      password.trim(),
      user.password.trim()
    );

    console.log("Password validation result:", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).send({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ username }, "ycf", {
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

    // Convert picture data to base64 for each pet
    const petsWithBase64Images = pets.map((pet) => {
      if (pet.picture && pet.picture.data) {
        const base64Image = pet.picture.data.toString("base64");
        const base64String = `data:${pet.picture.contentType};base64,${base64Image}`;
        return { ...pet.toObject(), picture: base64String };
      } else {
        return pet;
      }
    });

    res.send(petsWithBase64Images);
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
app.put(
  "/pets/:id",
  authenticateJWT,
  upload.single("picture"),
  async (req, res) => {
    try {
      const petId = req.params.id;
      const updateData = {
        ...req.body,
      };

      // Parse expenses if it's a JSON string
      if (req.body.expenses && typeof req.body.expenses === "string") {
        updateData.expenses = JSON.parse(req.body.expenses);
      }

      // Check if dates need to be converted to Date objects
      if (req.body.dateOfAdmission) {
        updateData.dateOfAdmission = new Date(req.body.dateOfAdmission);
      }
      if (req.body.dateOfDischarge) {
        updateData.dateOfDischarge = new Date(req.body.dateOfDischarge);
      }
      if (req.body.spotOnDate) {
        updateData.spotOnDate = new Date(req.body.spotOnDate);
      }
      if (req.body.dewormingDate) {
        updateData.dewormingDate = new Date(req.body.dewormingDate);
      }
      if (req.body.vaccinationDate) {
        updateData.vaccinationDate = new Date(req.body.vaccinationDate);
      }

      // Check if a file was uploaded
      if (req.file) {
        updateData.picture = {
          data: fs.readFileSync(req.file.path), // Read the file buffer
          contentType: req.file.mimetype, // Store the content type
        };
      }

      const updatedPet = await Pet.findByIdAndUpdate(petId, updateData, {
        new: true, // Return the updated document
        runValidators: true, // Ensure validation rules are applied
      });

      if (!updatedPet) {
        return res.status(404).send({ message: "Pet not found" });
      }

      res.status(200).send(updatedPet);
    } catch (error) {
      console.error(error);
      res.status(400).send(error);
    }
  }
);

app.post(
  "/pets",
  authenticateJWT,
  upload.single("picture"),
  async (req, res) => {
    console.log(req.body);
    try {
      const expenses = req.body.expenses;
      const pet = new Pet({
        ...req.body,
        expenses: expenses,
        // picture: {
        //   data: fs.readFileSync(req.file.path), // Read the file buffer
        //   contentType: req.file.mimetype // Store the content type
        // },
      });
      if (req.file) {
        pet.picture = {
          data: fs.readFileSync(req.file.path), // Read the file buffer
          contentType: req.file.mimetype, // Store the content type
        };
      }
      await pet.save();
      res.status(201).send(pet);
    } catch (error) {
      console.log(error);
      res.status(400).send(error);
    }
  }
);
app.post("/search", authenticateJWT, async (req, res) => {
  try {
    const { name, owner, spotOnStatus, dewormingStatus, vaccinationStatus } =
      req.body;

    // Build the query object based on provided criteria
    const query = {};
    if (name) {
      query.name = { $regex: new RegExp(name, "i") }; // Case-insensitive search for name
    }
    if (owner) {
      query.owner = { $regex: new RegExp(owner, "i") }; // Case-insensitive search for owner
    }
    if (spotOnStatus) {
      query.spotOnStatus = spotOnStatus; // Filter by spotOnStatus
    }
    if (dewormingStatus) {
      query.dewormingStatus = dewormingStatus; // Filter by dewormingStatus
    }
    if (vaccinationStatus) {
      query.vaccinationStatus = vaccinationStatus; // Filter by vaccinationStatus
    }

    // Execute the query
    const pets = await Pet.find(query);

    if (pets.length === 0) {
      return res
        .status(404)
        .json({ message: "No pets found matching the criteria" });
    }

    res.status(200).json(pets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
app.get("/pets/:id/download-pdf", async (req, res) => {
  const petId = req.params.id;

  try {
    // Fetch pet details from MongoDB
    const pet = await Pet.findById(petId);

    if (!pet) {
      return res.status(404).send({ message: "Pet not found" });
    }

    // Create a PDF document
    const doc = new PDFDocument();

    // Pipe the PDF content to a writable stream
    const filePath = path.join(__dirname, "uploads", `pet_bill_${petId}.pdf`);
    const outputStream = fs.createWriteStream(filePath);
    doc.pipe(outputStream);

    // PDF content generation
    doc.fontSize(20).text(`Pet Bill - ${pet.name}`, { align: 'center' }).moveDown(0.5);
    doc.fontSize(14).text(`Owner: ${pet.owner}`).moveDown(0.5);
    doc.text(`Contact: ${pet.contact}`).moveDown(0.5);
    doc.text(`Reason of Admission: ${pet.reasonOfAdmission}`).moveDown(0.5);
    doc.text(`Date of Admission: ${pet.dateOfAdmission.toLocaleDateString()}`).moveDown(0.5);
    if (pet.dateOfDischarge) {
      doc.text(`Date of Discharge: ${pet.dateOfDischarge.toLocaleDateString()}`).moveDown(0.5);
    }

    // Add a table for expenses
    doc.moveDown(1); // Add some space before the table
    doc.fontSize(14).text("Expenses", { underline: true }).moveDown(0.5);

    // Headers for the table
    const headers = ["Item", "Cost"];
    const table = {
      headers: headers,
      rows: [],
    };

    // Populate rows with pet expenses
    pet.expenses.forEach((expense) => {
      table.rows.push([expense.item, `RS${expense.cost.toFixed(2)}`]); // Formatting cost to 2 decimal places
    });

    // Calculate column widths and positioning
    const startX = 50;
    const startY = doc.y;
    const padding = 10;
    const rowHeight = 20;
    const col1Width = 300;
    const col2Width = 150;

    // Draw table headers
    doc.font("Helvetica-Bold").fontSize(12);
    doc.text(headers[0], startX, startY, { width: col1Width, align: "left" });
    doc.text(headers[1], startX + col1Width + padding, startY, { width: col2Width, align: "left" });

    // Draw table rows
    doc.font("Helvetica").fontSize(10);
    table.rows.forEach((row, index) => {
      const currentY = startY + (index + 1) * rowHeight;
      doc.text(row[0], startX, currentY, { width: col1Width, align: "left" });
      doc.text(row[1], startX + col1Width + padding, currentY, { width: col2Width, align: "left" });
    });

    // Add total expenses
    const totalCost = pet.expenses.reduce((acc, expense) => acc + expense.cost, 0);
    doc.moveDown(1); // Add space before total
    doc.fontSize(12).text(`Total Cost: RS${totalCost.toFixed(2)}`, { align: "right" }).moveDown(0.5);

    doc.end();

    // Once the PDF is generated, set headers and send the file for download
    res.setHeader("Content-Disposition", `attachment; filename="pet_bill_${petId}.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
