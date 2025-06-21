const express = require("express");
require("./clearUploadJob");
require("pdfkit-table");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Pet = require("./models/PetSchema");
const Expense = require("./models/ExpenseSchema");
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
app.post("/expenses", async (req, res) => {
  try {
    const expense = new Expense(req.body);
    await expense.save();
    res.status(201).json(expense);
  } catch (err) {
    console.error("Error adding expense:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/expenses - Get all expenses
app.get("/expenses", async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
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
    // const petsWithBase64Images = pets.map((pet) => {
    //   if (pet.picture && pet.picture.data) {
    //     const base64Image = pet.picture.data.toString("base64");
    //     const base64String = `data:${pet.picture.contentType};base64,${base64Image}`;
    //     return { ...pet.toObject(), picture: base64String };
    //   } else {
    //     return pet;
    //   }
    // });
    const petsWithoutPictures = pets.map((pet) => {
      const { picture, ...rest } = pet.toObject(); // Remove `picture` field
      return rest;
    });

    res.send(petsWithoutPictures);

    // res.send(petsWithBase64Images);
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
      const total = req.body.expenses.reduce(
        (ac, curVal) => ac + Number(curVal.cost),
        0
      );
      const updateData = {
        ...req.body,
        totalExpense: total,
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
      const total = expenses.reduce(
        (ac, curVal) => ac + Number(curVal.cost),
        0
      );
      console.log(total);
      const pet = new Pet({
        ...req.body,
        expenses: expenses,
        totalExpense: total,
        // picture: {
        //   data: fs.readFileSync(req.file.path), // Read the file buffer
        //   contentType: req.file.mimetype // Store the content type
        // },
      });
      // if (req.file) {
      //   pet.picture = {
      //     data: fs.readFileSync(req.file.path), // Read the file buffer
      //     contentType: req.file.mimetype, // Store the content type
      //   };
      // }
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
app.delete("/pets/:id", authenticateJWT, async (req, res) => {
  try {
    const petId = req.params.id;
    const deletedPet = await Pet.findByIdAndDelete(petId);

    if (!deletedPet) {
      return res.status(404).send({ message: "Pet not found" });
    }

    res.status(200).send({ message: "Pet deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

const QRCode = require("qrcode");
// app.get('/pets/:id/download-pdf', async (req, res) => {
//   const petId = req.params.id;
//   const uploadsDir = path.join(__dirname, 'uploads');
//   const generatedDir = path.join(__dirname, 'generated');
//   const filePath = path.join(generatedDir, `pet_bill_${petId}.pdf`);
//   const qrCodePath = path.join(uploadsDir, `pet_qr_${petId}.png`);
//   const qrCodeData = `https://example.com/pets/${petId}`;

//   // Ensure the required directories exist
//   if (!fs.existsSync(uploadsDir)) {
//       fs.mkdirSync(uploadsDir);
//   }
//   if (!fs.existsSync(generatedDir)) {
//       fs.mkdirSync(generatedDir);
//   }

//   try {
//       const doc = new PDFDocument();
//       const writeStream = fs.createWriteStream(filePath);

//       // Pipe PDF document to the file
//       doc.pipe(writeStream);

//       // Add initial content
//       doc.fontSize(18).text('Pet Bill', { align: 'center' }).moveDown();
//       doc.text(`Pet ID: ${petId}`).moveDown();

//       // Generate QR Code
//       await new Promise((resolve, reject) => {
//           QRCode.toFile(qrCodePath, qrCodeData, (err) => {
//               if (err) {
//                   console.error('Error generating QR code:', err);
//                   return reject(err);
//               }
//               console.log('QR Code saved at:', qrCodePath);
//               resolve();
//           });
//       });

//       // Add QR code to the PDF
//       doc.image(qrCodePath, { fit: [100, 100], align: 'right' }).moveDown();

//       // Finalize PDF
//       doc.end();

//       // Send the file
//       writeStream.on('finish', () => {
//           res.setHeader('Content-Disposition', `attachment; filename="pet_bill_${petId}.pdf"`);
//           res.setHeader('Content-Type', 'application/pdf');
//           res.sendFile(filePath, (err) => {
//               if (err) {
//                   console.error('Error sending file:', err);
//                   res.status(500).send({ message: 'Failed to send PDF document' });
//               }

//               // Clean up files
//               fs.unlinkSync(qrCodePath);
//               fs.unlinkSync(filePath);
//           });
//       });

//       writeStream.on('error', (err) => {
//           console.error('Error writing PDF file:', err);
//           res.status(500).send({ message: 'Error writing PDF file' });
//       });

//   } catch (error) {
//       console.error('Error generating PDF:', error);
//       res.status(500).send({ message: 'Error generating PDF' });
//   }
// });

app.get("/pets/:id/download-pdf", async (req, res) => {
  const petId = req.params.id;
  const uploadsDir = path.join(__dirname, "uploads");
  const generatedDir = path.join(__dirname, "generated");
  const filePath = path.join(generatedDir, `pet_bill_${petId}.pdf`);
  const qrCodePath = path.join(uploadsDir, `pet_qr_${petId}.png`);

  // Mock data for demonstration purposes
  const pet = await Pet.findById(petId);
  const totalCost = pet.expenses.reduce(
    (sum, expense) => sum + expense.cost,
    0
  );

  // Ensure directories exist
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir);

  try {
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(filePath);

    // Pipe PDF document to the file
    doc.pipe(writeStream);

    // Add PDF content
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Yasmin's Care Foundation", { align: "center" });
      doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("GSTIN: 19AABCY7251K1ZU", { align: "center" });
    doc.fontSize(14).text("Mallikpur Railway Station", { align: "center" });
    doc
      .text("Phone: +917980100636 | Email: yasmin.hanif2417@gmail.com", {
        align: "center",
      })
      .moveDown();

    doc
      .fontSize(18)
      .text(`Pet Bill - ${pet.name}`, { align: "center" })
      .moveDown();
    doc.fontSize(12).text(`Owner: ${pet.owner}`);
    doc.text(`Contact: ${pet.contact}`);
    doc.text(`Reason of Admission: ${pet.reasonOfAdmission}`);
    doc.text(`Date of Admission: ${pet.dateOfAdmission.toLocaleDateString()}`);
    if (pet.dateOfDischarge) {
      doc.text(
        `Date of Discharge: ${pet.dateOfDischarge.toLocaleDateString()}`
      );
    }
    doc.text(`Total Cost: ₹${totalCost}`).moveDown();
    // Table Headers
    const startX = 50; // Table X coordinate
    const tableWidth = 500; // Total table width
    const col1Width = 350; // Width of Item column
    const col2Width = tableWidth - col1Width; // Width of Cost column
    const rowHeight = 25; // Height of each row
    let currentY = doc.y + rowHeight;
    // let currentY = doc.y + rowHeight;
    doc.font("Helvetica-Bold").fontSize(12);

    // Header row
    doc.rect(startX, doc.y, col1Width, rowHeight).stroke(); // Item column
    doc.rect(startX + col1Width, doc.y, col2Width, rowHeight).stroke(); // Cost column

    // "Item" header text
    doc.text("Item", startX + 10, doc.y + 7, {
      width: col1Width - 20,
      align: "left",
    });

    // "Cost" header text (adjusted to fit within the cell)
    doc.text("Cost", startX + col1Width + 10, doc.y - 10, {
      width: col2Width - 20,
      align: "center",
    });

    // Expense rows
    // currentY += rowHeight;

    doc.font("Helvetica").fontSize(10);
    pet.expenses.forEach((expense) => {
      doc.rect(startX, currentY, col1Width, rowHeight).stroke();
      doc.rect(startX + col1Width, currentY, col2Width, rowHeight).stroke();
      doc.text(expense.item, startX + 10, currentY + 7, {
        width: col1Width - 20,
        align: "left",
      });
      doc.text(
        `₹${expense.cost.toFixed(2)}`,
        startX + col1Width + 10,
        currentY + 7,
        { width: col2Width - 20, align: "right" }
      );
      currentY += rowHeight;
    });

    // Total cost row
    doc.font("Helvetica-Bold");
    doc.rect(startX, currentY, tableWidth, rowHeight).stroke();
    doc.text("Total Cost", startX + 10, currentY + 7, {
      width: col1Width - 20,
      align: "center",
    });
    doc.text(
      `₹${totalCost.toFixed(2)}`,
      startX + col1Width + 10,
      currentY + 7,
      { width: col2Width - 20, align: "right" }
    );
    doc.moveDown(2);

    doc.font("Helvetica").fontSize(10);
    doc.text("Please Scan and Complete Your Payment", startX + 10, doc.y + 7, {
      width: col1Width - 20,
      align: "left",
    });
    // Generate QR Code for UPI payment
    const qrCodeData = `upi://pay?pa=7980100636-3@ybl&pn=Yasmin's Care Foundation&am=${totalCost}&cu=INR&tn=Pet Bill Payment`;
    await new Promise((resolve, reject) => {
      QRCode.toFile(qrCodePath, qrCodeData, (err) => {
        if (err) {
          console.error("Error generating QR code:", err);
          return reject(err);
        }
        console.log("QR Code saved at:", qrCodePath);
        resolve();
      });
    });

    // Add QR code to the PDF
    doc.image(qrCodePath, { fit: [100, 100], align: "right" }).moveDown();

    // Finalize PDF
    doc.end();

    // Send the PDF file after it's written
    writeStream.on("finish", () => {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pet_bill_${petId}.pdf"`
      );
      res.setHeader("Content-Type", "application/pdf");
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          res.status(500).send({ message: "Failed to send PDF document" });
        }

        // Clean up temporary files
        fs.unlinkSync(qrCodePath);
        fs.unlinkSync(filePath);
      });
    });

    writeStream.on("error", (err) => {
      console.error("Error writing PDF file:", err);
      res.status(500).send({ message: "Error writing PDF file" });
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send({ message: "Error generating PDF" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
