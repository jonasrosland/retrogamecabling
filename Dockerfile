FROM node:24-slim
WORKDIR /app

# Install build tools for native dependencies
# RUN apt-get update && apt-get install -y \
#     python3 \
#     make \
#     g++ \
#     && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 5000

# Run the dev server (hot reload enabled)
CMD ["npm", "run", "dev"]

