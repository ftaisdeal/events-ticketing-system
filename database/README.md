# Database Setup

This directory contains database-related files for the Events Ticketing System.

## Files

- `schema.sql` - Complete database schema with tables and sample data
- `migrations/` - Database migration files (if using Sequelize CLI)
- `seeds/` - Seed data files

## Setup Instructions

### 1. Install MySQL

**macOS (using Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Alternative: Using MySQL Docker Container:**
```bash
docker run --name mysql-ticketing -e MYSQL_ROOT_PASSWORD=your_password -p 3306:3306 -d mysql:8.0
```

### 2. Create Database and User

Connect to MySQL as root:
```bash
mysql -u root -p
```

Run the following commands:
```sql
-- Create database
CREATE DATABASE ticketing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user (optional but recommended)
CREATE USER 'ticketing_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON ticketing_system.* TO 'ticketing_user'@'localhost';
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

### 3. Import Schema

```bash
mysql -u root -p ticketing_system < schema.sql
```

### 4. Verify Setup

Connect to the database and verify tables:
```bash
mysql -u root -p ticketing_system
```

```sql
SHOW TABLES;
DESCRIBE users;
SELECT * FROM categories;
```

## Environment Configuration

Update your `.env` file with the database credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ticketing_system
DB_USER=root
DB_PASSWORD=your_password
```

## Using with Sequelize

If you're using Sequelize migrations, you can also manage the database schema through migration files:

```bash
# Install Sequelize CLI globally
npm install -g sequelize-cli

# Initialize Sequelize (from backend directory)
cd backend
sequelize init

# Create migration
sequelize migration:generate --name create-users-table

# Run migrations
npm run migrate

# Undo migrations
npm run migrate:undo
```

## Backup and Restore

### Create Backup
```bash
mysqldump -u root -p ticketing_system > backup_$(date +%Y%m%d).sql
```

### Restore from Backup
```bash
mysql -u root -p ticketing_system < backup_20240101.sql
```

## Security Considerations

1. Use strong passwords for database users
2. Limit database user privileges to only what's needed
3. Enable SSL for database connections in production
4. Regular backups
5. Monitor database access logs
