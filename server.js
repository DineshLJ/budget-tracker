const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = 'budgetTrackerDB';

console.log('Loaded MONGO_URL:', process.env.MONGO_URL); // Debug log
console.log('Using MongoDB URL:', mongoUrl); // Debug log

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

let db;

// Connect to MongoDB
async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('Connected to MongoDB successfully');
    db = client.db(dbName);

    await db.collection('transactions').createIndex({ date: 1 });
    await db.collection('transactions').createIndex({ category: 1 });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Routes
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await db.collection('transactions').find({}).toArray();
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = req.body;
    transaction.deposits = parseFloat(transaction.deposits) || 0;
    transaction.withdrawals = parseFloat(transaction.withdrawals) || 0;
    transaction.createdAt = new Date();

    const result = await db.collection('transactions').insertOne(transaction);
    res.status(201).json({
      _id: result.insertedId,
      ...transaction
    });
  } catch (error) {
    console.error('Error adding transaction:', error);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = req.body;
    delete transaction._id;

    const result = await db.collection('transactions').updateOne(
      { _id: new ObjectId(id) },
      { $set: transaction }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      _id: id,
      ...transaction
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection('transactions').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

app.post('/api/transactions/delete-multiple', async (req, res) => {
  try {
    const { ids } = req.body;
    const objectIds = ids.map(id => new ObjectId(id));

    const result = await db.collection('transactions').deleteMany({
      _id: { $in: objectIds }
    });

    res.json({
      message: `${result.deletedCount} transactions deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting transactions:', error);
    res.status(500).json({ error: 'Failed to delete transactions' });
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    const summary = await db.collection('transactions').aggregate([
      {
        $group: {
          _id: '$category',
          totalDeposits: { $sum: '$deposits' },
          totalWithdrawals: { $sum: '$withdrawals' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          totalDeposits: 1,
          totalWithdrawals: 1,
          count: 1,
          _id: 0
        }
      }
    ]).toArray();

    res.json(summary);
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

connectToMongo().then(() => {
  app.listen(port, () => {
    console.log(`Budget tracker server listening at http://localhost:${port}`);
  });
});