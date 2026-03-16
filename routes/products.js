var express = require("express");
let slugify = require("slugify");
var router = express.Router();
let modelProduct = require("../schemas/products");
let modelInventory = require("../schemas/inventories");
const { default: mongoose } = require("mongoose");

async function runInTransaction(work) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/* GET users listing. */
//localhost:3000/api/v1
router.get("/", async function (req, res, next) {
  let data = await modelProduct.find({});
  let queries = req.query;
  let titleQ = queries.title ? queries.title : "";
  let maxPrice = queries.maxPrice ? queries.maxPrice : 1e4;
  let minPrice = queries.minPrice ? queries.minPrice : 0;
  let limit = queries.limit ? queries.limit : 5;
  let page = queries.page ? queries.page : 1;
  let result = data.filter(function (e) {
    return (
      !e.isDeleted &&
      e.price >= minPrice &&
      e.price <= maxPrice &&
      e.title.toLowerCase().includes(titleQ)
    );
  });
  result = result.splice(limit * (page - 1), limit);
  res.send(result);
});
router.get("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let result = await modelProduct.findById(id);
    if (result && !result.isDeleted) {
      res.send(result);
    } else {
      res.status(404).send({
        message: "ID not found",
      });
    }
  } catch (error) {
    res.status(404).send({
      message: "ID not found",
    });
  }
});

router.post("/", async function (req, res, next) {
  try {
    let newObj = await runInTransaction(async function (session) {
      let product = new modelProduct({
        title: req.body.title,
        slug: slugify(req.body.title, {
          replacement: "-",
          remove: undefined,
          locale: "vi",
          trim: true,
        }),
        price: req.body.price,
        description: req.body.description,
        category: req.body.category,
        images: req.body.images,
      });
      let newProduct = await product.save({ session });
      let newInv = new modelInventory({
        product: newProduct._id,
        stock: 100,
      });
      await newInv.save({ session });
      return product;
    });
    res.send(newObj);
  } catch (error) {
    res.status(404).send(error.message);
  }
});
//replica set
router.put("/:id", async function (req, res, next) {
  let id = req.params.id;
  try {
    let id = req.params.id;
    //c1
    // let result = await modelProduct.findById(id)
    // if (result) {
    //   //res.send(result)
    //   let keys = Object.keys(req.body);
    //   for (const key of keys) {
    //     result[key]=req.body[key];
    //   }
    //   await result.save()
    // } else {
    //   res.status(404).send({
    //     message: "ID not found"
    //   })
    // }
    //c2:
    let result = await modelProduct.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.send(result);
  } catch (error) {
    res.status(404).send({
      message: "ID not found",
    });
  }
});
router.delete("/:id", async function (req, res, next) {
  let id = req.params.id;
  try {
    let id = req.params.id;
    //c1
    // let result = await modelProduct.findById(id)
    // if (result) {
    //   //res.send(result)
    //   let keys = Object.keys(req.body);
    //   for (const key of keys) {
    //     result[key]=req.body[key];
    //   }
    //   await result.save()
    // } else {
    //   res.status(404).send({
    //     message: "ID not found"
    //   })
    // }
    //c2:
    let result = await modelProduct.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
      },
      {
        new: true,
      },
    );
    res.send(result);
  } catch (error) {
    res.status(404).send({
      message: "ID not found",
    });
  }
});
module.exports = router;
