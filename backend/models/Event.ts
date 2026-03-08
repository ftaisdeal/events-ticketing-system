import { DataTypes, Sequelize } from 'sequelize';

const createEventModel = (sequelize: Sequelize) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    shortDescription: {
      type: DataTypes.STRING(500)
    },
    slug: {
      type: DataTypes.STRING,
      unique: true,
      validate: {
        is: /^[a-z0-9-]+$/
      }
    },
    startDateTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endDateTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    timezone: {
      type: DataTypes.STRING,
      defaultValue: 'UTC'
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'cancelled', 'completed'),
      defaultValue: 'draft'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    featuredImage: {
      type: DataTypes.STRING
    },
    images: {
      type: DataTypes.JSON
    },
    maxCapacity: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1
      }
    },
    ageRestriction: {
      type: DataTypes.INTEGER,
      validate: {
        min: 0,
        max: 21
      }
    },
    tags: {
      type: DataTypes.JSON
    },
    socialLinks: {
      type: DataTypes.JSON
    },
    organizer: {
      type: DataTypes.JSON
    },
    refundPolicy: {
      type: DataTypes.TEXT
    },
    termsAndConditions: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'events',
    timestamps: true,
    indexes: [
      {
        fields: ['slug']
      },
      {
        fields: ['startDateTime']
      },
      {
        fields: ['status']
      },
      {
        fields: ['organizerId']
      }
    ]
  });

  (Event as any).associate = (models: Record<string, any>) => {
    Event.belongsTo(models.User, {
      foreignKey: 'organizerId',
      as: 'organizerUser'
    });
    Event.belongsTo(models.Venue, {
      foreignKey: 'venueId',
      as: 'venue'
    });
    Event.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      as: 'category'
    });
    Event.hasMany(models.TicketType, {
      foreignKey: 'eventId',
      as: 'ticketTypes'
    });
    Event.hasMany(models.Order, {
      foreignKey: 'eventId',
      as: 'orders'
    });
  };

  return Event;
};

export default createEventModel;
