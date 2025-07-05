# 🧠 QueryPal
### The Natural Language MongoDB Query App

This full-stack application allows users to interact with MongoDB using **natural language** — powered by **Google Gemini** for language understanding and **FastAPI** for backend processing.

Users can simply type queries like:

> “Find all patients older than 65.”  
> “Insert a new user named Alice into the `users` collection.”  

The app intelligently translates that into valid MongoDB operations, confirms with the user, and then executes the query securely.

---

## 🔧 Key Features

- 🧠 **AI-Powered Query Generation**  
  Uses Google Gemini to convert natural language into MongoDB query code.

- ⚙️ **MongoDB Integration**  
  Runs generated queries directly against selected MongoDB databases.

- ✅ **User Confirmation Flow**  
  Every AI-generated operation is shown to the user for review before execution.

- 🖥️ **Full-Stack Architecture**  
  - Frontend: React + TypeScript
  - Backend: FastAPI (Python) with modular design

- 🔐 **Secure Backend Logic**  
  Gemini API key and MongoDB operations are handled only in the backend to protect credentials and data.

---

## 📦 Tech Stack

| Layer     | Technology            |
|-----------|------------------------|
| Frontend  | React, TypeScript, Vite |
| Backend   | FastAPI, Pydantic, Uvicorn |
| AI Engine | Google Gemini (via API) |
| Database  | MongoDB (Atlas / CosmosDB compatible) |

---

## 🏁 Getting Started

To run the app locally, set up the frontend and backend independently using the provided `README.md` files in each directory.

Typical flow:
1. Start the backend server.
2. Run the frontend dev server.
3. Use the app in your browser to connect to a database and perform natural language queries.

---

## 🌐 Example Use Cases

- Quickly retrieve records without writing query syntax
- Allow non-technical users to interact with databases
- Teach MongoDB query structures via natural language examples

---

## 🚧 Status

This is a working prototype and developer tool — additional hardening and sandboxing may be needed before use in production.

---

## 🙌 Credits

Developed with ❤️ using FastAPI, MongoDB, and Google Gemini.