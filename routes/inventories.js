var express = require("express");
var router = express.Router();
let inventoryModel = require("../schemas/inventories");
const mongoose = require("mongoose");

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

router.get("/", async function (req, res, next) {
  let inventories = await inventoryModel.find({}).populate({
    path: "product",
    select: "title price",
  });
  res.send(inventories);
});
router.post("/increase-stock", async function (req, res, next) {
  try {
    let { product, quantity } = req.body;
    let getProduct = await runInTransaction(async function (session) {
      let foundProduct = await inventoryModel
        .findOne({
          product: product,
        })
        .session(session);
      console.log(foundProduct);
      if (foundProduct) {
        foundProduct.stock += quantity;
        await foundProduct.save({ session });
        return foundProduct;
      }
      return null;
    });
    if (getProduct) {
      res.send(getProduct);
    } else {
      res.status(404).send({
        message: "Product not found",
      });
    }
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});
router.post("/decrease-stock", async function (req, res, next) {
  try {
    let { product, quantity } = req.body;
    let getProduct = await runInTransaction(async function (session) {
      let foundProduct = await inventoryModel
        .findOne({
          product: product,
        })
        .session(session);
      if (foundProduct) {
        if (foundProduct.stock >= quantity) {
          foundProduct.stock -= quantity;
          await foundProduct.save({ session });
          return { product: foundProduct };
        }
        return { notEnoughStock: true };
      }
      return { notFound: true };
    });
    if (getProduct.product) {
      res.send(getProduct.product);
    } else {
      if (getProduct.notEnoughStock) {
        res.status(404).send({
          message: "Product khong du so luong",
        });
      } else {
        res.status(404).send({
          message: "Product not found",
        });
      }
    }
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});
module.exports = router;
