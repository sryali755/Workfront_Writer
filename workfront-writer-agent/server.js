import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createTask, createTaskUpdate } from "./workfront.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Workfront Writer Agent Running");
});

app.post("/generate", async (req, res) => {
  try {

    const { prompt } = req.body;

    const response = await axios.post(
      "https://api.writer.com/v1/chat/completions",
      {
        model: "palmyra-x-004",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WRITER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiContent =
      response.data.choices[0].message.content;

    res.json(response.data);

  } catch (error) {

    const errDetail = error.response?.data || error.message;
    process.stdout.write("GENERATE ERROR: " + JSON.stringify(errDetail) + "\n");

    res.status(500).json({
      error: "Writer API failed",
      detail: errDetail
    });
  }
});

app.post("/push-to-workfront", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    const task = await createTask("AI Generated Status Update", content);
    const taskID = task.data?.ID;

    if (!taskID) {
      return res.status(500).json({ error: "Workfront task was created without an ID" });
    }

    const update = await createTaskUpdate(taskID, content);

    res.json({ success: true, task, update });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to push to Workfront" });
  }
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
