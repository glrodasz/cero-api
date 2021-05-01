const findAll = {
  response: {
    200: {
      type: "array",
      items: {
        properties: {
          name: { type: "string" },
        },
      },
    },
  },
};

const insertOne = {
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
    },
  },
};

const deleteOne = {
  params: {
    type: "object",
    properties: {
      name: { type: "string" },
    },
  },
};

module.exports = { findAll, insertOne, deleteOne };
