-- Events Ticketing System Database Schema
-- MySQL Database Setup

-- Create database
CREATE DATABASE IF NOT EXISTS ticketing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ticketing_system;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(50) NOT NULL,
    lastName VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'organizer', 'admin') DEFAULT 'customer',
    isVerified BOOLEAN DEFAULT FALSE,
    verificationToken VARCHAR(255),
    resetPasswordToken VARCHAR(255),
    resetPasswordExpires DATETIME,
    lastLogin DATETIME,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Categories table
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#1976d2',
    icon VARCHAR(50),
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug)
);

-- Venues table
CREATE TABLE venues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100) NOT NULL,
    postalCode VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    capacity INT,
    amenities JSON,
    contactInfo JSON,
    images JSON,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_city (city),
    INDEX idx_country (country)
);

-- Events table
CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    shortDescription VARCHAR(500),
    slug VARCHAR(255) NOT NULL UNIQUE,
    startDateTime DATETIME NOT NULL,
    endDateTime DATETIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    status ENUM('draft', 'published', 'cancelled', 'completed') DEFAULT 'draft',
    isPublic BOOLEAN DEFAULT TRUE,
    featuredImage VARCHAR(500),
    images JSON,
    maxCapacity INT,
    ageRestriction INT DEFAULT 0,
    tags JSON,
    socialLinks JSON,
    organizer JSON,
    refundPolicy TEXT,
    termsAndConditions TEXT,
    organizerId INT NOT NULL,
    venueId INT,
    categoryId INT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organizerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (venueId) REFERENCES venues(id) ON DELETE SET NULL,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_slug (slug),
    INDEX idx_start_date (startDateTime),
    INDEX idx_status (status),
    INDEX idx_organizer (organizerId),
    INDEX idx_category (categoryId)
);

-- Ticket Types table
CREATE TABLE ticket_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    eventId INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    quantity INT NOT NULL,
    quantitySold INT DEFAULT 0,
    maxPerOrder INT DEFAULT 10,
    saleStartDate DATETIME,
    saleEndDate DATETIME,
    isActive BOOLEAN DEFAULT TRUE,
    metadata JSON,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
    INDEX idx_event (eventId),
    INDEX idx_active (isActive)
);

-- Orders table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orderNumber VARCHAR(50) NOT NULL UNIQUE,
    userId INT NOT NULL,
    eventId INT NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled', 'refunded', 'failed', 'expired') DEFAULT 'pending',
    totalAmount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    discountAmount DECIMAL(10, 2) DEFAULT 0,
    taxAmount DECIMAL(10, 2) DEFAULT 0,
    serviceFee DECIMAL(10, 2) DEFAULT 0,
    promoCode VARCHAR(50),
    customerInfo JSON,
    billingAddress JSON,
    notes TEXT,
    expiresAt DATETIME,
    confirmedAt DATETIME,
    confirmationEmailSentAt DATETIME,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
    INDEX idx_order_number (orderNumber),
    INDEX idx_user (userId),
    INDEX idx_event (eventId),
    INDEX idx_status (status)
);

-- Tickets table
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticketNumber VARCHAR(50) NOT NULL UNIQUE,
    shortCode VARCHAR(16) NOT NULL UNIQUE,
    orderId INT NOT NULL,
    ticketTypeId INT NOT NULL,
    attendeeName VARCHAR(200),
    attendeeEmail VARCHAR(255),
    price DECIMAL(10, 2) NOT NULL,
    status ENUM('valid', 'used', 'cancelled', 'transferred') DEFAULT 'valid',
    qrCode TEXT,
    checkInTime DATETIME,
    transferHistory JSON,
    metadata JSON,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (ticketTypeId) REFERENCES ticket_types(id) ON DELETE CASCADE,
    INDEX idx_ticket_number (ticketNumber),
    INDEX idx_order (orderId),
    INDEX idx_status (status),
    INDEX idx_qr_code (qrCode(255))
);

-- Payments table
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT NOT NULL,
    paymentIntentId VARCHAR(255),
    provider ENUM('stripe', 'paypal', 'square') DEFAULT 'stripe',
    method VARCHAR(50),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'expired') DEFAULT 'pending',
    transactionId VARCHAR(255),
    metadata JSON,
    failureReason TEXT,
    refundAmount DECIMAL(10, 2) DEFAULT 0,
    refundedAt DATETIME,
    processedAt DATETIME,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (orderId),
    INDEX idx_payment_intent (paymentIntentId),
    INDEX idx_status (status)
);

-- Ticket check-ins table
CREATE TABLE ticket_check_ins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticketId INT NOT NULL UNIQUE,
    eventId INT NOT NULL,
    scannedByUserId INT NOT NULL,
    source VARCHAR(32) DEFAULT 'scanner',
    deviceId VARCHAR(128),
    notes VARCHAR(255),
    metadata JSON,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (scannedByUserId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_checkin_event (eventId),
    INDEX idx_checkin_staff (scannedByUserId),
    INDEX idx_checkin_source (source)
);

-- Insert sample categories
INSERT INTO categories (name, slug, description, color, icon) VALUES
('Music', 'music', 'Concerts, festivals, and musical performances', '#e91e63', 'music_note'),
('Sports', 'sports', 'Sporting events and competitions', '#ff9800', 'sports'),
('Theater', 'theater', 'Plays, musicals, and theatrical performances', '#9c27b0', 'theater_comedy'),
('Technology', 'technology', 'Tech conferences, workshops, and meetups', '#2196f3', 'computer'),
('Business', 'business', 'Business conferences and networking events', '#4caf50', 'business'),
('Food & Drink', 'food-drink', 'Food festivals, wine tastings, and culinary events', '#ff5722', 'restaurant'),
('Arts & Culture', 'arts-culture', 'Art exhibitions, cultural events, and workshops', '#795548', 'palette'),
('Health & Wellness', 'health-wellness', 'Fitness, yoga, and wellness events', '#8bc34a', 'favorite');

-- Create admin user (password: admin123)
INSERT INTO users (firstName, lastName, email, password, role, isVerified) VALUES
('Admin', 'User', 'admin@ticketing.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', TRUE);
