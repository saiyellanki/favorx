# FavorX API Documentation

## Overview

The FavorX API is a RESTful API that provides access to the FavorX platform's functionality. The API uses JWT for authentication and supports JSON for request/response formats.

## Base URL 
```
http://localhost:3000/api
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Rate Limiting

The API implements rate limiting with the following defaults:
- General API: 100 requests per 15 minutes
- Authentication: 5 attempts per hour
- Profile updates: 10 updates per hour
- Search: 30 requests per minute
- Reviews: 5 reviews per day

### Error Handling

All errors follow the format:
```json
{
  "error": "Error message",
  "status": 400
}
```

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
```

Request body:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

Response:
```json
{
  "token": "string",
  "user": {
    "id": "integer",
    "username": "string",
    "email": "string"
  }
}
```

#### Login
```http
POST /auth/login
```

Request body:
```json
{
  "email": "string",
  "password": "string"
}
```

Response:
```json
{
  "token": "string",
  "user": {
    "id": "integer",
    "username": "string"
  }
}
```

### Profile

#### Get Profile
```http
GET /profile/:userId
```

Response:
```json
{
  "profile": {
    "id": "integer",
    "user_id": "integer",
    "full_name": "string",
    "bio": "string",
    "location": "string",
    "profile_image_url": "string",
    "karma_score": "number",
    "is_verified": "boolean"
  }
}
```

#### Update Profile
```http
PUT /profile
```

Request body:
```json
{
  "full_name": "string",
  "bio": "string",
  "location": "string"
}
```

### Skills

#### Create Skill
```http
POST /skills
```

Request body:
```json
{
  "category": "string",
  "title": "string",
  "description": "string",
  "effort_time": "integer",
  "is_offering": "boolean"
}
```

#### Search Skills
```http
GET /skills/search
```

Query parameters:
- `q`: Search query (string)
- `category`: Filter by category (string)
- `location`: Location name (string)
- `radius`: Search radius in km (number)
- `page`: Page number (integer)
- `limit`: Results per page (integer)

Response:
```json
{
  "skills": [
    {
      "id": "integer",
      "user_id": "integer",
      "category": "string",
      "title": "string",
      "description": "string",
      "effort_time": "integer",
      "is_offering": "boolean",
      "user": {
        "username": "string",
        "karma_score": "number"
      }
    }
  ],
  "pagination": {
    "page": "integer",
    "limit": "integer",
    "total": "integer",
    "pages": "integer"
  }
}
```

### Reviews & Ratings

#### Create Review
```http
POST /reviews
```

Request body:
```json
{
  "reviewed_id": "integer",
  "skill_id": "integer",
  "title": "string",
  "content": "string"
}
```

#### Create Rating
```http
POST /ratings
```

Request body:
```json
{
  "rated_id": "integer",
  "skill_id": "integer",
  "rating": "integer (1-5)",
  "review": "string"
}
```

### Trust & Safety

#### Request Verification
```http
POST /verifications
```

Request body (multipart/form-data):
- `type`: Verification type (id, address, professional)
- `full_name`: Full name for ID verification
- `id_front`: Front of ID document (file)
- `id_back`: Back of ID document (file)

Response:
```json
{
  "verification": {
    "id": "integer",
    "type": "string",
    "status": "string",
    "created_at": "string"
  }
}
```

#### Create Report
```http
POST /reports
```

Request body:
```json
{
  "reported_id": "integer",
  "type": "string (user, skill, review, rating)",
  "target_id": "integer",
  "reason": "string",
  "description": "string"
}
```

## WebSocket Events

The API supports real-time events via WebSocket connections:

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

// Event types
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'new_message':
      // Handle new message
      break;
    case 'favor_request':
      // Handle new favor request
      break;
    case 'rating_received':
      // Handle new rating
      break;
  }
};
```

### Event Types

#### Message Events
```json
{
  "type": "new_message",
  "data": {
    "message_id": "integer",
    "sender_id": "integer",
    "content": "string",
    "timestamp": "string"
  }
}
```

#### Favor Request Events
```json
{
  "type": "favor_request",
  "data": {
    "request_id": "integer",
    "skill_id": "integer",
    "requester_id": "integer",
    "message": "string"
  }
}
```

#### Rating Events
```json
{
  "type": "rating_received",
  "data": {
    "rating_id": "integer",
    "rating": "integer",
    "skill_id": "integer",
    "rater_id": "integer"
  }
}
```

## Karma System

### Get User Karma Score
```http
GET /karma/:userId
```

Response:
```json
{
  "karma_score": "number",
  "components": {
    "rating_score": "number",
    "completion_score": "number",
    "consistency_score": "number",
    "activity_score": "number"
  },
  "stats": {
    "total_favors": "integer",
    "successful_favors": "integer",
    "average_rating": "number"
  }
}
```

## Messaging

### Get Conversations
```http
GET /messages/conversations
```

Response:
```json
{
  "conversations": [
    {
      "id": "integer",
      "participant": {
        "id": "integer",
        "username": "string",
        "profile_image_url": "string"
      },
      "last_message": {
        "content": "string",
        "timestamp": "string",
        "is_read": "boolean"
      },
      "unread_count": "integer"
    }
  ]
}
```

### Get Messages
```http
GET /messages/:conversationId
```

Query parameters:
- `before`: Timestamp for pagination (string)
- `limit`: Number of messages to return (integer)

Response:
```json
{
  "messages": [
    {
      "id": "integer",
      "sender_id": "integer",
      "content": "string",
      "timestamp": "string",
      "is_read": "boolean"
    }
  ],
  "has_more": "boolean"
}
```

### Send Message
```http
POST /messages/:conversationId
```

Request body:
```json
{
  "content": "string"
}
```

## Favor Matching

### Get Matches
```http
GET /matches
```

Query parameters:
- `skill_id`: Filter by skill (integer)
- `location`: Location name (string)
- `radius`: Search radius in km (number)
- `page`: Page number (integer)
- `limit`: Results per page (integer)

Response:
```json
{
  "matches": [
    {
      "user": {
        "id": "integer",
        "username": "string",
        "karma_score": "number",
        "profile_image_url": "string"
      },
      "skill": {
        "id": "integer",
        "title": "string",
        "category": "string"
      },
      "match_score": "number",
      "distance": "number"
    }
  ],
  "pagination": {
    "page": "integer",
    "limit": "integer",
    "total": "integer",
    "pages": "integer"
  }
}
```

### Request Favor
```http
POST /favors/request
```

Request body:
```json
{
  "skill_id": "integer",
  "message": "string",
  "proposed_time": "string",
  "location": {
    "name": "string",
    "latitude": "number",
    "longitude": "number"
  }
}
```

Response:
```json
{
  "request": {
    "id": "integer",
    "status": "pending",
    "created_at": "string"
  }
}
```

## Notifications

### Get Notifications
```http
GET /notifications
```

Query parameters:
- `unread_only`: Filter unread notifications (boolean)
- `page`: Page number (integer)
- `limit`: Results per page (integer)

Response:
```json
{
  "notifications": [
    {
      "id": "integer",
      "type": "string",
      "data": "object",
      "is_read": "boolean",
      "created_at": "string"
    }
  ],
  "unread_count": "integer",
  "pagination": {
    "page": "integer",
    "limit": "integer",
    "total": "integer",
    "pages": "integer"
  }
}
```

### Mark Notification as Read
```http
PUT /notifications/:notificationId/read
```

Response:
```json
{
  "success": true
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400  | Bad Request - Invalid input parameters |
| 401  | Unauthorized - Authentication required |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource doesn't exist |
| 409  | Conflict - Resource already exists |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error |

## Development

### Testing

The API includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- src/tests/integration/auth.test.js
```

### Environment Variables

Required environment variables:

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=favorx
DB_USER=postgres
DB_PASSWORD=password

# JWT
JWT_SECRET=your-secret-key

# Redis
REDIS_URL=redis://localhost:6379

# AWS (for file uploads)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
``` 