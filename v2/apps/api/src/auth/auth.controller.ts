import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any, @Res() res: Response) {
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid credentials' });
    }
    const tokenData = await this.authService.login(user);
    
    res.cookie('access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    });

    return res.status(HttpStatus.OK).json({ success: true });
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('access_token');
    return res.status(HttpStatus.OK).json({ success: true });
  }
}
