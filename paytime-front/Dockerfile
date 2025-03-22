# Build stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

# Add host flag to make it accessible from outside the container
CMD ["npm", "run", "dev", "--", "--host"] 