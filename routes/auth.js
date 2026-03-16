var express = require("express");
var router = express.Router();
let userController = require("../controllers/users");
let jwt = require("jsonwebtoken");
let bcrypt = require("bcrypt");
let { checkLogin } = require("../utils/authHandler.js");
let {
  changePasswordValidator,
  validateResult,
  resetPasswordValidator,
} = require("../utils/validatorHandler");
let crypto = require("crypto");
let mailHandler = require("../utils/sendMailHandler");
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

/* GET home page. */
//localhost:3000
router.post("/register", async function (req, res, next) {
  try {
    await runInTransaction(async function (session) {
      await userController.CreateAnUser(
        req.body.username,
        req.body.password,
        req.body.email,
        "69a5462f086d74c9e772b804",
        session,
      );
    });
    res.send({
      message: "dang ki thanh cong",
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});
router.post("/login", async function (req, res, next) {
  let result = await userController.QueryByUserNameAndPassword(
    req.body.username,
    req.body.password,
  );
  if (result) {
    let token = jwt.sign(
      {
        id: result.id,
      },
      "secret",
      {
        expiresIn: "1h",
      },
    );
    res.cookie("token", token, {
      maxAge: 60 * 60 * 1000,
      httpOnly: true,
    });
    res.send(token);
  } else {
    res.status(404).send({ message: "sai THONG TIN DANG NHAP" });
  }
});
router.get("/me", checkLogin, async function (req, res, next) {
  console.log(req.userId);
  let getUser = await userController.FindUserById(req.userId);
  res.send(getUser);
});
router.post("/logout", checkLogin, function (req, res, next) {
  res.cookie("token", null, {
    maxAge: 0,
    httpOnly: true,
  });
  res.send("da logout ");
});
router.post(
  "/changepassword",
  checkLogin,
  changePasswordValidator,
  validateResult,
  async function (req, res, next) {
    try {
      let { oldpassword, newpassword } = req.body;
      let updated = await runInTransaction(async function (session) {
        let user = await userController.FindUserById(req.userId, session);
        console.log(user);
        if (!bcrypt.compareSync(oldpassword, user.password)) {
          return false;
        }
        user.password = newpassword;
        await user.save({ session });
        return true;
      });
      if (updated) {
        res.send("password da duoc thay doi");
      } else {
        res.status(404).send("old password sai");
      }
    } catch (error) {
      res.status(400).send({ message: error.message });
    }
  },
);
router.post("/forgotpassword", async function (req, res, next) {
  try {
    let email = req.body.email;
    let user = await runInTransaction(async function (session) {
      let foundUser = await userController.FindUserByEmail(email, session);
      if (!foundUser) {
        return null;
      }
      foundUser.forgotpasswordToken = crypto.randomBytes(21).toString("hex");
      foundUser.forgotpasswordTokenExp = new Date(Date.now() + 10 * 60 * 1000);
      await foundUser.save({ session });
      return foundUser;
    });
    if (!user) {
      res.status(404).send({
        message: "email khong ton tai",
      });
      return;
    }
    let URL =
      "http://localhost:3000/api/v1/auth/resetpassword/" +
      user.forgotpasswordToken;
    mailHandler.sendMail(user.email, URL);
    res.send("check mail");
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});
router.post(
  "/resetpassword/:token",
  resetPasswordValidator,
  validateResult,
  async function (req, res, next) {
    try {
      let password = req.body.password;
      let token = req.params.token;
      let updated = await runInTransaction(async function (session) {
        let user = await userController.FindUserByToken(token, session);
        if (!user) {
          return false;
        }
        user.password = password;
        user.forgotpasswordToken = null;
        user.forgotpasswordTokenExp = null;
        await user.save({ session });
        return true;
      });
      if (!updated) {
        res.status(404).send("token reset password sai");
        return;
      }
      res.send("update password thanh cong");
    } catch (error) {
      res.status(400).send({ message: error.message });
    }
  },
);

module.exports = router;
