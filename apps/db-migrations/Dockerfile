FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
CMD ["npm", "run", "migration:run"]
