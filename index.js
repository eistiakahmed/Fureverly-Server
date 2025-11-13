const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@fureverlydb.o2jukph.mongodb.net/?appName=fureverlyDB`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get('/', (req, res) => {
  res.send('Fureverly Server is running...');
});

async function run() {
  try {
    // await client.connect();
    const db = client.db('fureverlyDB');
    const petCollection = db.collection('petCollection');
    const orderCollection = db.collection('orderCollection');

    // Latest listing (6 items)
    app.get('/latestListing', async (req, res) => {
      const result = await petCollection
        .find()
        .sort({ date: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // All products
    app.get('/product', async (req, res) => {
      const result = await petCollection.find().toArray();
      res.send(result);
    });

    // Single product by ID
    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const result = await petCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.post('/product', async (req, res) => {
      const newProduct = req.body;
      const result = await petCollection.insertOne(newProduct);
      res.send(result);
    });

    app.put('/product/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const result = await petCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: data }
      );
      res.send(result);
    });

    app.delete('/product/:id', async (req, res) => {
      const id = req.params.id;
      const result = await petCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Category filter
    app.get('/products', async (req, res) => {
      const category = req.query.category;
      const query = { category: category };
      const result = await petCollection.find(query).toArray();
      res.send(result);
    });

    // Search by category
    app.get('/filterCategory', async (req, res) => {
      const search_text = req.query.search;
      const query = search_text
        ? { category: { $regex: search_text, $options: 'i' } }
        : {};
      const result = await petCollection.find(query).toArray();
      res.send(result);
    });

    // Search by name
    app.get('/searchName', async (req, res) => {
      const search_text = req.query.search;
      const query = search_text
        ? { name: { $regex: search_text, $options: 'i' } }
        : {};
      const result = await petCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/myListing', async (req, res) => {
      const email = req.query.email;
      const result = await petCollection.find({ email: email }).toArray();
      console.log(result)
      res.send(result);
    });

    app.get('/orders', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/orders', async (req, res) => {
      const newOrder = req.body;
      // newOrder.email = req.user.email;
      const result = await orderCollection.insertOne(newOrder);
      res.send(result);
    });

    console.log('MongoDB Connected Successfully!');
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Fureverly Server is running on port: ${port}`);
});
