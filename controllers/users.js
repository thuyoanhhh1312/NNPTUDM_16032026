let userModel = require("../schemas/users");
let bcrypt = require("bcrypt");
module.exports = {
  CreateAnUser: async function (
    username,
    password,
    email,
    role,
    session,
    avatarUrl,
    fullName,
    status,
    loginCount,
  ) {
    let newUser = new userModel({
      username: username,
      password: password,
      email: email,
      role: role,
      avatarUrl: avatarUrl,
      fullName: fullName,
      status: status,
      loginCount: loginCount,
    });
    await newUser.save({ session });
    return newUser;
  },
  QueryByUserNameAndPassword: async function (username, password, session) {
    let query = userModel.findOne({ username: username });
    if (session) {
      query = query.session(session);
    }
    let getUser = await query;
    if (!getUser) {
      return false;
    }
    if (bcrypt.compareSync(password, getUser.password)) {
      return getUser;
    }
    return false;
  },
  FindUserById: async function (id, session) {
    let query = userModel
      .findOne({
        _id: id,
        isDeleted: false,
      })
      .populate("role");
    if (session) {
      query = query.session(session);
    }
    return await query;
  },
  FindUserById: async function (id, session) {
    let query = userModel
      .findOne({
        _id: id,
        isDeleted: false,
      })
      .populate("role");
    if (session) {
      query = query.session(session);
    }
    return await query;
  },
  FindUserByEmail: async function (email, session) {
    let query = userModel.findOne({
      email: email,
      isDeleted: false,
    });
    if (session) {
      query = query.session(session);
    }
    return await query;
  },
  FindUserByToken: async function (token, session) {
    let query = userModel.findOne({
      forgotpasswordToken: token,
      isDeleted: false,
    });
    if (session) {
      query = query.session(session);
    }
    let user = await query;
    if (!user || user.forgotpasswordTokenExp < Date.now()) {
      return false;
    }
    return user;
  },
};
