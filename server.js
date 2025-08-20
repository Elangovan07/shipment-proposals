require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "http://localhost:5000", credentials: true } });

app.use(cors({
  origin: "http://localhost:5000",  // or the correct front-end domain
  credentials: true,
}));

// Increase JSON payload size limit to e.g. 10MB (adjust as needed)
app.use(express.json({ limit: '10mb' }));
// similarly if you are using urlencoded parser
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'adminsecret',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// API routes (avoid route conflicts, mount each only once)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/pricing', require('./routes/pricingRoutes'));
app.use('/api/email-template', require('./routes/templateRoutes'));
app.use('/api/proposals', require('./routes/proposalRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));

app.use('/api/contacts', require('./routes/contactsRoutes'));   // /api/contacts
app.use('/api/shipments', require('./routes/shipmentRoutes')); // /api/shipments

// DetailsRoute: mount other forms if needed
const detailsRouter = require('./routes/detailsRoutes');
app.use('/api', detailsRouter);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});

app.get('/', (req, res) => {
  res.redirect('/pages/login.html');
});
