var express = require("express");
var router = express.Router();
let { checkLogin, checkRole } = require("../utils/authHandler.js");
let cartModel = require("../schemas/cart");
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

router.get("/", checkLogin, async function (req, res, next) {
  let userId = req.userId;
  let currentCart = await cartModel.findOne({
    user: userId,
  });
  res.send(currentCart.items);
});
router.post("/add-items", checkLogin, async function (req, res, next) {
  try {
    let userId = req.userId;
    let { product, quantity } = req.body;
    let currentCart = await runInTransaction(async function (session) {
      let cart = await cartModel
        .findOne({
          user: userId,
        })
        .session(session);
      let index = cart.items.findIndex(function (e) {
        return e.product == product;
      });
      if (index < 0) {
        cart.items.push({
          product: product,
          quantity: quantity,
        });
      } else {
        cart.items[index].quantity += quantity;
      }
      await cart.save({ session });
      return cart;
    });
    res.send(currentCart);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});
router.post("/decrease-items", checkLogin, async function (req, res, next) {
  try {
    let userId = req.userId;
    let { product, quantity } = req.body;
    let currentCart = await runInTransaction(async function (session) {
      let cart = await cartModel
        .findOne({
          user: userId,
        })
        .session(session);
      let index = cart.items.findIndex(function (e) {
        return e.product == product;
      });
      if (index < 0) {
      } else {
        if (cart.items[index].quantity > quantity) {
          cart.items[index].quantity -= quantity;
        } else {
          if (cart.items[index].quantity == quantity) {
            cart.items.splice(index, 1);
          }
        }
      }
      await cart.save({ session });
      return cart;
    });
    res.send(currentCart);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
