var express = require("express");
var router = express.Router();
const mongoose = require("mongoose");

let roleModel = require("../schemas/roles");

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
  let roles = await roleModel.find({ isDeleted: false });
  res.send(roles);
});

router.get("/:id", async function (req, res, next) {
  try {
    let result = await roleModel.find({ _id: req.params.id, isDeleted: false });
    if (result.length > 0) {
      res.send(result);
    } else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", async function (req, res, next) {
  try {
    let newItem = await runInTransaction(async function (session) {
      let role = new roleModel({
        name: req.body.name,
        description: req.body.description,
      });
      await role.save({ session });
      return role;
    });
    res.send(newItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await roleModel.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await roleModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
