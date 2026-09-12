export type EmailDto = {
  to: string;
  message: string;
  subject: string;
  html: string;
};

export type TermiiResponse = {
  code: string;
  balance: string;
  message_id: string;
  message: string;
  user: string;
};
