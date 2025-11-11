const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// MongoDB URL
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@fureverlydb.o2jukph.mongodb.net/?appName=fureverlyDB`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Default route
app.get('/', (req, res) => {
  res.send(' Fureverly Server is running...');
});

async function run() {
  try {
    await client.connect();

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

    //  All products
    app.get('/product', async (req, res) => {
      const result = await petCollection.find().toArray();
      res.send(result);
    });

    //  Single product by ID
    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await petCollection.findOne(filter);
      res.send(result);
    });

    app.post('/product', async (req, res) => {
      const newProduct = req.body;
      const result = await petCollection.insertOne(newProduct);
      res.send(result);
    });

    //  Category wise filter
    app.get('/products', async (req, res) => {
      const category = req.query.category;
      let query = {};

      if (category) {
        query = { category: category };
      }
      const result = await petCollection.find(query).toArray();
      res.send(result);
    });
 
    // Update Method
    app.put('/product/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: data,
      };

      const result = await petCollection.updateOne(filter, update);
      res.send(result);
    });

    app.delete('/product/:id', async(req,res) => { 
      const id = req.params.id
      const result = await petCollection.deleteOne({_id: new ObjectId(id)})
      res.send(result)
    })

    // Search Method
    app.get('/search', async (req, res) => {
      const search_text = req.query.search;
      const result = await petCollection
        .find({ category: { $regex: search_text, $options: 'i' } })
        .toArray();
      res.send(result);
    });

     
    // Find by Email
    app.get('/myListing', async (req, res) => {
      const email = req.query.email;
      const result = await petCollection.find({ email: email }).toArray();
      res.send(result);
    });

    // Order 
    app.get('/orders', async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    // Order Post 
    app.post('/orders', async (req, res) => {
      const newOrder = req.body;
      const result = await orderCollection.insertOne(newOrder);
      res.send(result);
    });

    // await client.db('admin').command({ ping: 1 });
    console.log(' MongoDB Connected Successfully!');
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(` Fureverly ServerDB is running on port: ${port}`);
});
