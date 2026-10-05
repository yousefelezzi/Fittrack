# FitTrack

A comprehensive fitness tracking application with mobile, web, and server components. Track your workouts, nutrition, exercises, and connect with other fitness enthusiasts.

## Features

- **User Authentication**: Secure registration and login with strong password validation
- **Workout Tracking**: Log workout sessions and create custom workout plans
- **Nutrition Logging**: Track your daily nutrition intake
- **Exercise Library**: Browse and manage exercises
- **Social Features**: Create and share fitness posts with the community
- **Cross-Platform**: Available on web and mobile platforms
- **Real-time Updates**: Synchronized data across devices

## Tech Stack

### Frontend
- **Web**: React, Axios, Context API
- **Mobile**: React Native/Expo

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Password Security**: bcrypt
- **File Storage**: local server uploads
- **Validation**: express-validator

### DevOps
- **Containerization**: Docker & Docker Compose

## Project Structure

```
fittrack/
├── client-web/          # React web application
├── client-mobile/       # React Native mobile app
├── server/              # Express.js backend
│   ├── controllers/     # Route handlers
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   └── config/          # Configuration files
├── shared/              # Shared utilities
└── docker-compose.yml   # Docker configuration
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Docker & Docker Compose (optional)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fittrack
   ```

2. **Install dependencies**
   ```bash
   # Server
   cd server
   npm install
   
   # Web client
   cd ../client-web
   npm install
   
   # Mobile client
   cd ../client-mobile
   npm install
   ```

3. **Configure environment variables**
   
   Create `.env` file in the `server` directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/fittrack
   JWT_SECRET=your_jwt_secret_key
   JWT_REFRESH_SECRET=your_jwt_refresh_secret
   CLIENT_URL=http://localhost:5173
   NODE_ENV=development
   ```

4. **Run with Docker Compose** (recommended)
   ```bash
   docker-compose up
   ```

   Or run locally:
   ```bash
   # Start MongoDB
   mongod
   
   # Start server
   cd server
   npm start
   
   # In another terminal, start web client
   cd client-web
   npm start
   
   # For mobile, use Expo
   cd client-mobile
   npx expo start
   ```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user profile

### Workout Endpoints

- `GET /api/workout` - Get all workouts
- `POST /api/workout` - Create a new workout
- `GET /api/workout/:id` - Get workout details
- `PUT /api/workout/:id` - Update workout
- `DELETE /api/workout/:id` - Delete workout

### Nutrition Endpoints

- `GET /api/nutrition` - Get nutrition logs
- `POST /api/nutrition` - Log nutrition
- `GET /api/nutrition/:id` - Get nutrition details
- `PUT /api/nutrition/:id` - Update nutrition
- `DELETE /api/nutrition/:id` - Delete nutrition

### Exercise Endpoints

- `GET /api/exercise` - Get all exercises
- `POST /api/exercise` - Create exercise
- `GET /api/exercise/:id` - Get exercise details
- `PUT /api/exercise/:id` - Update exercise
- `DELETE /api/exercise/:id` - Delete exercise

### Plan Endpoints

- `GET /api/plan` - Get workout plans
- `POST /api/plan` - Create workout plan
- `GET /api/plan/:id` - Get plan details
- `PUT /api/plan/:id` - Update plan
- `DELETE /api/plan/:id` - Delete plan

### Post Endpoints

- `GET /api/post` - Get all posts
- `POST /api/post` - Create post
- `GET /api/post/:id` - Get post details
- `PUT /api/post/:id` - Update post
- `DELETE /api/post/:id` - Delete post

### User Endpoints

- `GET /api/user` - Search users
- `GET /api/user/:id` - Get user profile
- `PUT /api/user/:id` - Update user profile
- `DELETE /api/user/:id` - Delete user account

## Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

Example: `MyFitness@123`

## Development

### Running Tests
```bash
cd server
npm test
```

### Build for Production
```bash
# Web
cd client-web
npm run build

# Mobile
cd client-mobile
npx expo build:android
npx expo build:ios
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Security

- Passwords are hashed using bcrypt with salt rounds of 12
- JWT tokens are used for secure API authentication
- Input validation is performed on all endpoints using express-validator
- Sensitive data (passwords) is excluded from API responses

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongod`
- Check connection string in `.env` file
- Verify database permissions

### Port Already in Use
- Change PORT in `.env` file
- Or kill the process using the port: `lsof -i :5000` then `kill -9 <PID>`

### JWT Token Expired
- Generate a new token by logging in again
- Use the refresh endpoint to get a new token

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues, questions, or suggestions, please open an issue on the repository.

---

**Happy tracking! 💪**
