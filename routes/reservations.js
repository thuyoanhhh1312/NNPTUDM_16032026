var express = require("express");
var router = express.Router();
const mongoose = require("mongoose");
let reservationModel = require("../schemas/reservations");
let cartModel = require("../schemas/cart");
let inventoryModel = require("../schemas/inventories");
let { checkLogin } = require("../utils/authHandler.js");

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

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items is required");
  }

  const merged = new Map();
  for (const item of items) {
    if (!item || !item.product || !item.quantity) {
      throw new Error("each item must include product and quantity");
    }
    if (!mongoose.Types.ObjectId.isValid(item.product)) {
      throw new Error("invalid product id");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("quantity must be a positive integer");
    }

    const key = item.product.toString();
    const current = merged.get(key) || 0;
    merged.set(key, current + item.quantity);
  }

  return Array.from(merged.entries()).map(function ([product, quantity]) {
    return { product, quantity };
  });
}

async function releaseReservationItems(items, session) {
  for (const item of items) {
    const inventory = await inventoryModel
      .findOne({ product: item.product })
      .session(session);
    if (!inventory) {
      continue;
    }
    inventory.stock += item.quantity;
    inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
    await inventory.save({ session });
  }
}

async function reserveForUser(userId, sourceItems, session) {
  const items = normalizeItems(sourceItems);
  const reservationItems = [];
  let totalAmount = 0;

  let existingReservation = await reservationModel
    .findOne({ user: userId })
    .session(session);

  if (existingReservation && existingReservation.status === "actived") {
    await releaseReservationItems(existingReservation.items, session);
  }

  for (const item of items) {
    const inventory = await inventoryModel
      .findOne({ product: item.product })
      .populate({
        path: "product",
        select: "price isDeleted",
      })
      .session(session);

    if (!inventory || !inventory.product || inventory.product.isDeleted) {
      throw new Error("product not found");
    }

    if (inventory.stock < item.quantity) {
      throw new Error("product stock is not enough");
    }

    inventory.stock -= item.quantity;
    inventory.reserved += item.quantity;
    await inventory.save({ session });

    const price = inventory.product.price || 0;
    const subtotal = price * item.quantity;

    reservationItems.push({
      product: item.product,
      quantity: item.quantity,
      price,
      subtotal,
    });

    totalAmount += subtotal;
  }

  if (!existingReservation) {
    existingReservation = new reservationModel({
      user: userId,
    });
  }

  existingReservation.items = reservationItems;
  existingReservation.totalAmount = totalAmount;
  existingReservation.status = "actived";
  existingReservation.ExpiredAt = new Date(Date.now() + 10 * 60 * 1000);

  await existingReservation.save({ session });

  return await existingReservation.populate({
    path: "items.product",
    select: "title price images",
  });
}

router.get("/", checkLogin, async function (req, res, next) {
  try {
    let reservations = await reservationModel
      .find({
        user: req.userId,
      })
      .populate({
        path: "items.product",
        select: "title price images",
      });
    res.send(reservations);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.get("/:id", checkLogin, async function (req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "invalid reservation id" });
    }

    let reservation = await reservationModel
      .findOne({
        _id: req.params.id,
        user: req.userId,
      })
      .populate({
        path: "items.product",
        select: "title price images",
      });

    if (!reservation) {
      return res.status(404).send({
        message: "reservation not found for this user",
      });
    }

    res.send(reservation);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.post("/reserveACart", checkLogin, async function (req, res, next) {
  try {
    const reservation = await runInTransaction(async function (session) {
      const cart = await cartModel
        .findOne({ user: req.userId })
        .session(session);

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error("cart is empty");
      }

      const reserved = await reserveForUser(req.userId, cart.items, session);
      cart.items = [];
      await cart.save({ session });
      return reserved;
    });

    res.send(reservation);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.post("/reserveItems", checkLogin, async function (req, res, next) {
  try {
    const reservation = await runInTransaction(async function (session) {
      return await reserveForUser(req.userId, req.body.items, session);
    });

    res.send(reservation);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.post("/cancelReserve/:id", checkLogin, async function (req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ message: "invalid reservation id" });
    }

    const reservation = await reservationModel.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!reservation) {
      return res
        .status(404)
        .send({ message: "reservation not found for this user" });
    }

    if (reservation.status === "cancelled") {
      return res.send(reservation);
    }

    for (const item of reservation.items) {
      const inventory = await inventoryModel.findOne({ product: item.product });
      if (!inventory) {
        continue;
      }
      inventory.stock += item.quantity;
      inventory.reserved = Math.max(0, inventory.reserved - item.quantity);
      await inventory.save();
    }

    reservation.status = "cancelled";
    await reservation.save();

    const populated = await reservation.populate({
      path: "items.product",
      select: "title price images",
    });

    res.send(populated);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
