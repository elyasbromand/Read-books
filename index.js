import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  password: "admin",
  database: "Book_Project",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let books = [
  {
    id: 1,
    isbn: "9780143127550",
    title: "Deep Work",
    author: "Cal Newport",
    date_read: "2024-02-09T19:30:00.000Z",
    book_id: 1,
    summary:
      "Focus is the new IQ. This book emphasizes the value of deep, focused work in a distracted world.",
    notes: "Avoid social media, set time blocks for deep work.",
    tags: "productivity, focus, mindset",
    rating: 5,
  },
];

async function getBooks(sort) {
  let sortClause = "";
  const allowedSorts = ["date_read", "rating", "title"];

  if (allowedSorts.includes(sort)) {
    sortClause = `ORDER BY ${sort}`;
  }
  if (sort == "rating") {
    sortClause = `ORDER BY rating DESC`;
  }
  const query = `
        SELECT books.id, * 
        FROM books 
        JOIN book_details ON books.id = book_details.book_id 
        ${sortClause}
    `;

  const result = await db.query(query);
  return result.rows;
}

async function getImage(isbn) {
  try {
    const response = await axios.get(
      `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`,
      {
        validateStatus: (status) => status >= 200 && status < 300,
        responseType: "stream",
      }
    );

    return response.request.res.responseUrl;
  } catch (err) {
    console.error(`Failed to fetch image for ISBN ${isbn}:`, err.message);
    return null;
  }
}

app.get("/", async (req, res) => {
  const sort = req.query.sort || "";
  let books = await getBooks(sort);

  for (const book of books) {
    try {
      const image = await getImage(book.isbn);
      book["image"] = image;
    } catch (err) {
      book["image"] = null;
      console.error("Error fetching image:", err.message);
    }
  }

  res.render("index.ejs", { books, sort });
});

app.get("/new", (req, res) => {
  res.render("new.ejs");
});

app.post("/add", async (req, res) => {
  const isbn = req.body.isbn;
  const title = req.body.title;
  const author = req.body.author;
  const date_read = req.body.date_read;
  const summary = req.body.summary;
  const notes = req.body.notes;
  const rating = req.body.rating;
  const tags = req.body.tags;

  try {
    let id = await db.query(
      "INSERT INTO books (isbn, title, author, date_read) VALUES ($1, $2, $3, $4) RETURNING *",
      [isbn, title, author, date_read]
    );
    id = id.rows[0].id;
    console.log(id);
    db.query(
      "INSERT INTO book_details (book_id ,summary, notes, rating, tags) VALUES ($1, $2, $3, $4, $5) ",
      [id, summary, notes, rating, tags]
    );

    res.redirect("/");
  } catch (err) {
    console.log(err.message);
    res.redirect("/");
  }
});

app.post("/edit", (req, res) => {
  const id = parseInt(req.body.book_id);

  const book = books.find((bookie) => bookie.id == id);
  console.log(book);
  res.render("edit.ejs", { book });
});

app.post("/edit_record", (req, res) => {
  const id = parseInt(req.body.book_id);
  const summary = req.body.summary.trim();
  const notes = req.body.notes.trim();
  const rating = req.body.rating.trim();
  const tags = req.body.tags.trim();
  try {
    db.query(
      "UPDATE book_details SET summary = $1, notes = $2, tags = $3, rating = $4 WHERE id = $5",
      [summary, notes, tags, rating, id]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err.message);
    res.redirect("/");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
