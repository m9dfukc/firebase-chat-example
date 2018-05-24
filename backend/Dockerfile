FROM node:9.11.1

RUN mkdir /app


WORKDIR /app
ADD package.json /app/package.json
RUN npm install

EXPOSE 3030

CMD npm run dev
