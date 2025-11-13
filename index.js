const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminKey.json');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Verify Firebase Token Middleware
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: 'Unauthorized access. Token not found!',
    });
  }

  const token = authorization.split(' ')[1];
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.user = decodedUser;
    next();
  } catch (error) {
    res.status(401).send({
      message: 'Unauthorized access. Invalid token.',
    });
  }
};

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

    // Add new product (protected)
    app.post('/product', verifyToken, async (req, res) => {
      const newProduct = req.body;
      const result = await petCollection.insertOne(newProduct);
      res.send(result);
    });

    // Update product by ID (protected)
    app.put('/product/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const result = await petCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: data }
      );
      res.send(result);
    });

    // Delete product by ID (protected)
    app.delete('/product/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await petCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Category filter
    app.get('/products', async (req, res) => {
      const category = req.query.category;
      const query = category ? { category } : {};
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

    // Get listings by logged-in user (protected)
    app.get('/myListing', verifyToken, async (req, res) => {
      const email = req.user.email;
      const result = await petCollection.find({ email }).toArray();
      res.send(result);
    });

    // Orders (protected)
    app.get('/orders', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = email ? { email } : {};
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // Add order (protected)
    app.post('/orders', verifyToken, async (req, res) => {
      const newOrder = req.body;
      newOrder.email = req.user.email;
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
