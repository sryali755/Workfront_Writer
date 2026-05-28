import axios from "axios";

export async function createTask(
  name,
  description
) {

  try {

    const body = new URLSearchParams({
      projectID: process.env.WORKFRONT_PROJECT_ID,
      name,
      description
    });

    const response = await axios.post(
      `${process.env.WORKFRONT_DOMAIN}/attask/api/v17.0/task?apiKey=${process.env.WORKFRONT_API_KEY}`,
      body.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log(
      "WORKFRONT RESPONSE:",
      response.data
    );

    return response.data;

  } catch (error) {

    console.error(
      "WORKFRONT ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
}

export async function createTaskUpdate(taskID, content) {
  try {
    const body = new URLSearchParams({
      objID: taskID,
      noteObjCode: "TASK",
      noteText: content
    });

    const response = await axios.post(
      `${process.env.WORKFRONT_DOMAIN}/attask/api/v17.0/note?apiKey=${process.env.WORKFRONT_API_KEY}`,
      body.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log(
      "WORKFRONT UPDATE RESPONSE:",
      response.data
    );

    return response.data;
  } catch (error) {
    console.error(
      "WORKFRONT UPDATE ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
}
