const mongoose = require("mongoose");

const PetSchema = new mongoose.Schema({
  name: String,
  picture: {
    data: Buffer, // Store the binary data
    contentType: String // Store the content type of the picture
  },
  owner: String,
  expenses: [
    {
      item: String,
      cost: Number,
    },
  ],
});

const Pet = mongoose.model("Pet", PetSchema);
module.exports = Pet;
