const cron = require("node-cron");
const fs = require("fs-extra");
const path = require("path");

const uploadsDir = path.join(__dirname, "uploads"); // Adjust the path to your uploads folder

// Define the cron schedule (runs every day at midnight)
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Clearing uploads folder...");
    await fs.emptyDir(uploadsDir); // Empty the uploads directory
    console.log("Uploads folder cleared successfully.");
  } catch (error) {
    console.error("Error clearing uploads folder:", error);
  }
});
