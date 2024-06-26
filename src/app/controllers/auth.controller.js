const { User } = require("../../services/db");
const bycript = require("bcrypt");
const jwt = require("jsonwebtoken");
const randToken = require('rand-token');
const config = require("../configs/config");
const promisify = require("util").promisify;

const sign = promisify(jwt.sign).bind(jwt);
const verify = promisify(jwt.verify).bind(jwt);

exports.register = async (req, res) => {
    try {
        const { email, password, name, phoneNumber } = req.body;
        const user = await User.findOne({ where: { email: email } });
        if (user) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const hashedPassword = await bycript.hashSync(password, 10);
        const newUser = await User.create({
            email: email,
            password: hashedPassword,
            name: name,
            phoneNumber: phoneNumber,
        });

        return res.status(201).json(newUser);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // check if email exists
        const user = await User.scope('withPassword').findOne({ where: { email: email } });
        if (!user) {
            return res.status(400).json({ message: "Email not found" });
        }

        const isPasswordValid = await bycript.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Password is incorrect" });
        }

        const accessTokenLife = config.accessTokenLife;
        const accessTokenSecret = config.accessTokenSecret;

        const dataForAccessToken = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        const accessToken = await this.generateToken(dataForAccessToken, accessTokenSecret, accessTokenLife);
        if (!accessToken) {
            return res.status(401).json({ message: "Login failed" });
        }

        let refreshToken = randToken.generate(config.refreshTokenSize);
        if (!user.refreshToken) {
            // user has no refresh token
            await User.update({ refreshToken: refreshToken }, { where: { id: user.id } });
        } else {
            // user has refresh token
            refreshToken = user.refreshToken;
        }

        // remove password and refresh token from user object
        const userWithoutPassword = user.toJSON();
        delete userWithoutPassword.password;
        delete userWithoutPassword.refreshToken;

        return res.status(200).json({
            msg: "Login successfully",
            user: userWithoutPassword,
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

exports.generateToken = async (payload, secretSignature, tokenLife) => {
    try {
        return await sign(
            {
                payload,
            },
            secretSignature,
            {
                algorithm: 'HS256',
                expiresIn: tokenLife,
            },
        );
    } catch (error) {
        console.log(`Error in generate access token:  + ${error}`);
        return null;
    }
}

exports.refreshToken = async (req, res) => {
    try {
        // get access token from header
        const accessTokenFromHeader = req.accessToken;
        if (!accessTokenFromHeader) {
            return res.status(400).json({ message: "Access token is required" });
        }

        // get refresh token from body
        const refreshTokenFromBody = req.body.refreshToken;
        if (!refreshTokenFromBody) {
            return res.status(400).json({ message: "Refresh token is required" });
        }

        // verify access token
        const accessTokenSecret = config.accessTokenSecret;
        const accessTokenLife = config.accessTokenLife;

        const decodedAccessToken = await this.decodeToken(accessTokenFromHeader, accessTokenSecret);
        if (!decodedAccessToken) {
            return res.status(401).json({ message: "Access token is invalid" });
        }

        // get user from access token
        const userId = decodedAccessToken.payload.id;
        const user = await User.scope('withPassword').findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // check refresh token
        if (user.refreshToken !== refreshTokenFromBody) {
            return res.status(400).json({ message: "Refresh token is invalid" });
        }

        // generate new access token
        const dataForAccessToken = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        const newAccessToken = await this.generateToken(dataForAccessToken, accessTokenSecret, accessTokenLife);
        if (!newAccessToken) {
            return res.status(401).json({ message: "Refresh token failed" });
        }

        return res.status(200).json({ accessToken: newAccessToken });

    } catch (error) {
        console.log(error);

        return res.status(500).json({ message: "Internal server error" });
    }
}

exports.decodeToken = async (token, secretKey) => {
    try {
        return await verify(token, secretKey, {
            ignoreExpiration: true,
        });
    } catch (error) {
        console.log(`Error in decode access token: ${error}`);
        return null;
    }
};

exports.verifyToken = async (token, secretKey) => {
	try {
		return await verify(token, secretKey);
	} catch (error) {
		console.log(`Error in verify access token:  + ${error}`);
		return null;
	}
};

exports.logout = async (req, res) => {
    try {
        // get user from access token
        const { id } = req.user;
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // remove refresh token from user
        await User.update({ refreshToken: null }, { where: { id: user.id } });

        return res.status(200).json({ message: "Logout successfully" });

    } catch (error) {
        console.log(error);

        return res.status(500).json({ message: "Internal server error" });
    }
}
