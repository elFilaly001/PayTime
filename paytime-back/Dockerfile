# Use the official Node.js image as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Install NestJS CLI and nodemon globally
RUN npm install -g @nestjs/cli nodemon

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Set environment variables for development
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the application with nodemon
CMD ["nodemon", "--watch", "src", "--ext", "ts,js", "--exec", "npm run start:dev"]

