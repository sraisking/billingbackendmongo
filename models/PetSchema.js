const mongoose = require("mongoose");

const PetSchema = new mongoose.Schema({
  name: String,
  picture: {
    data: Buffer, // Store the binary data
    contentType: String, // Store the content type of the picture
  },
  owner: String,
  expenses: [
    {
      item: String,
      cost: Number,
    },
  ],
  dateOfAdmission: {
    type: Date,
    required: true,
  },
  dateOfDischarge: Date,
  spotOnStatus: {
    type: String,
    enum: ["pending", "completed"], // Example, you can adjust as per your requirement
  },
  spotOnDate: Date,
  dewormingStatus: {
    type: String,
    enum: ["pending", "completed"], // Example, you can adjust as per your requirement
  },
  dewormingDate: Date,
  vaccinationStatus: {
    type: String,
    enum: ["pending", "completed"], // Example, you can adjust as per your requirement
  },
  vaccinationDate: Date,
  contact: String,
});

const Pet = mongoose.model("Pet", PetSchema);
module.exports = Pet;
