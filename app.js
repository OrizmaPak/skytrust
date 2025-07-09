require('dotenv').config();
require('express-async-errors');
const path = require('path');
const ngrok = require('@ngrok/ngrok');

// extra security packages
const helmet = require('helmet');
const xss = require('xss-clean');
const express = require('express');
const cors = require('cors');
const app = express(); 
app.set('trust proxy', 1); 

// routers
const authRouter = require('./routes/auth');
const branchRouter = require('./routes/branch');   
const adminRouter = require('./routes/admin'); 
const inventoryRouter = require('./routes/inventory');
const glaccountsRouter = require('./routes/glaccounts');
const memberRouter = require('./routes/members'); 
const savingsRouter = require('./routes/savings');
const loanRouter = require('./routes/loan');
const paymentRouter = require('./routes/payment');
const transactionsRouter = require('./routes/transactions');
const purchasesRouter = require('./routes/purchases'); 
const expenseRouter = require('./routes/expense');
const incomingsRouter = require('./routes/incomings');
const propertyRouter = require('./routes/property');
const rotaryRouter = require('./routes/rotary');
const salesRouter = require('./routes/sales');
const personnelRouter = require('./routes/personnel');
const aiRouter = require('./routes/ai');
const bankRouter = require('./routes/bank');

// error handler
const notFoundMiddleware = require('./middleware/not-found'); 
const errorHandlerMiddleware = require('./middleware/error-handler');

// middleware
const { requestprocessor } = require('./middleware/requestprocessor');
const authMiddleware = require('./middleware/authentication');
const transactionMiddleware = require('./middleware/transactions/transaction');
const { decryptMiddleware, encryptResponseMiddleware } = require('./middleware/encrypt');

app.use(express.json());
app.use(helmet());
app.use(xss());
app.use(cors()); // Add CORS middleware to fix cross-origin errors

const corsOptions = {
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
 
app.use(cors(corsOptions));

app.use(express.urlencoded({ extended: true }));
app.use(decryptMiddleware);
app.use(encryptResponseMiddleware);
app.use(requestprocessor);
   
// routes   
app.use('/node/api/v1/auth', authRouter);
app.use('/node/api/v1/branch', branchRouter);
app.use('/node/api/v1/admin', authMiddleware, adminRouter);
// app.use('/node/api/v1/inventory', authMiddleware, inventoryRouter);
app.use('/node/api/v1/glaccounts', authMiddleware, glaccountsRouter);
app.use('/node/api/v1/members', authMiddleware, memberRouter);
app.use('/node/api/v1/savings', authMiddleware, savingsRouter);
app.use('/node/api/v1/loan', authMiddleware, loanRouter);
app.use('/node/api/v1/payment', authMiddleware, transactionMiddleware, paymentRouter);
app.use('/node/api/v1/payment2', transactionMiddleware, paymentRouter);
app.use('/node/api/v1/transactions', authMiddleware, transactionsRouter); 
app.use('/node/api/v1/bank', authMiddleware, bankRouter);
// app.use('/node/api/v1/purchases', authMiddleware, purchasesRouter);
// app.use('/node/api/v1/expense', authMiddleware, expenseRouter);
// app.use('/node/api/v1/sales', authMiddleware, salesRouter);
// app.use('/node/api/v1/property', authMiddleware, propertyRouter);
// app.use('/node/api/v1/rotary', authMiddleware, rotaryRouter);
// app.use('/node/api/v1/personnel', authMiddleware, personnelRouter);

// app.use('/node/api/v1/incomings', incomingsRouter); 
// app.use('/node/api/v1/ai', aiRouter);

app.get('/node/', (req, res) => {
    res.send('Welcome to the Sky Trust backend!');
});
app.use('/node/*', (req, res) => {
    res.send(`wild card handled this route: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
});





app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5001;

const start = async () => {
  try {
    // Start your Express server
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is listening on port ${port}...`);
    });

    // Only set up ngrok in development mode
    if (process.env.NODE_ENV === 'development') {
      // Establish connectivity
      const listener = await ngrok.forward({
        addr: port,
        authtoken_from_env: true,
      });

      // Output ngrok URL to console
      console.log(`ngrok tunnel opened at: ${listener.url()}`);
    }
  } catch (error) {
    console.log('Error starting server or ngrok tunnel:', error);
  }
};

start();
