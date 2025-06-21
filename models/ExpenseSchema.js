// models/Expense.js
const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema({
  referenceId: { type: String, unique: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  description: String,
  date: { type: Date, default: Date.now },
  paymentType: {
    type: String,
    enum: ["Cash", "Online"],
    required: true,
  },
  attachment: {
    url: String,
    filename: String,
  },
});

ExpenseSchema.pre("save", function (next) {
  if (!this.referenceId) {
    this.referenceId = `EXP-${Date.now()}`;
  }
  next();
});

module.exports = mongoose.model("Expense", ExpenseSchema);