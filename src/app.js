require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { getHealth } = require('./controllers/healthController');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const permissionRoutes = require('./routes/permissions');
const departmentRoutes = require('./routes/departments');
const agencyRoutes = require('./routes/agencies');
const busRoutes = require('./routes/buses');
const driverRoutes = require('./routes/drivers');
const destinationRoutes = require('./routes/destinations');
const scheduleRoutes = require('./routes/schedules');
const tripRoutes = require('./routes/trips');
const seatRoutes = require('./routes/seats');
const reservationRoutes = require('./routes/reservations');
const ticketRoutes = require('./routes/tickets');
const ticketPublicRoutes = require('./routes/ticketPublic');
const parcelRoutes = require('./routes/parcels');
const vehicleRoutes = require('./routes/vehicles');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const auditLogRoutes = require('./routes/auditLogs');
const adminRoutes = require('./routes/admin');
const vehicleMediaRoutes = require('./routes/vehicleMedia');
const vehicleInquiryRoutes = require('./routes/vehicleInquiries');
const vehicleReservationRoutes = require('./routes/vehicleReservations');
const vehiclePaymentRoutes = require('./routes/vehiclePayments');
const reservationPaymentRoutes = require('./routes/reservationPayments');
const constructionCustomerRequestsRoutes = require('./routes/constructionCustomerRequests');
const constructionQuoteRequestsRoutes = require('./routes/constructionQuoteRequests');
const constructionProjectsRoutes = require('./routes/constructionProjects');
const constructionEngineerRoutes = require('./routes/constructionEngineer');
const constructionProjectUpdatesRoutes = require('./routes/constructionProjectUpdates');
const constructionProjectGalleryRoutes = require('./routes/constructionProjectGallery');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const adminMediaRoutes = require('./routes/adminMedia');
const publicRoutes = require('./routes/public');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const envOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

const clientDistDir = path.join(__dirname, '../client-frontend/dist');
const adminDistDir = path.join(__dirname, '../admin-frontend/dist');

const serveSpaIndex = (distDir, predicate) => (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!predicate(req)) return next();

  const indexPath = path.join(distDir, 'index.html');
  return res.sendFile(indexPath, (error) => {
    if (error) next(error);
  });
};

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api/public', publicRoutes);
app.use('/api', healthRoutes);
app.get('/health', getHealth);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/agencies', agencyRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/tickets', ticketPublicRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/vehicle-media', vehicleMediaRoutes);
app.use('/api/vehicle-inquiries', vehicleInquiryRoutes);
app.use('/api/vehicle-reservations', vehicleReservationRoutes);
app.use('/api/vehicle-payments', vehiclePaymentRoutes);
app.use('/api/reservation-payments', reservationPaymentRoutes);
app.use('/api/construction/customer-requests', constructionCustomerRequestsRoutes);
app.use('/api/construction/quote-requests', constructionQuoteRequestsRoutes);
app.use('/api/construction/projects', constructionProjectsRoutes);
app.use('/api/construction/engineer', constructionEngineerRoutes);
app.use('/api/construction/projects/:projectId/updates', constructionProjectUpdatesRoutes);
app.use('/api/construction/projects/:projectId/gallery', constructionProjectGalleryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/admin', adminRoutes);
app.use('/api/admin/media', adminMediaRoutes);

const clientSpaPredicate = (req) => {
  const pathname = decodeURIComponent(req.path || '/');
  return pathname === '/'
    || pathname === '/agent'
    || pathname.startsWith('/transport')
    || pathname.startsWith('/construction')
    || pathname.startsWith('/automobile')
    || pathname.startsWith('/contact')
    || pathname.startsWith('/tickets/')
    || pathname.startsWith('/public/')
    || pathname === '/login';
};

const adminSpaPredicate = (req) => {
  const pathname = decodeURIComponent(req.path || '/');
  return pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/login';
};

if (process.env.NODE_ENV === 'production') {
  app.use('/admin/assets', express.static(path.join(adminDistDir, 'assets'), { index: false }));
  app.use('/admin', express.static(adminDistDir, { index: false }));
  app.use('/admin', serveSpaIndex(adminDistDir, adminSpaPredicate));
  app.use(express.static(clientDistDir, { index: false }));
  app.use(serveSpaIndex(clientDistDir, clientSpaPredicate));
}

app.get('/', (req, res) => {
  res.json({
    name: process.env.APP_NAME || 'Vanguard Services',
    status: 'backend running',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;