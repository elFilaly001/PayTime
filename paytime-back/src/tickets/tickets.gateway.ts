// import {
//   WebSocketGateway,
//   WebSocketServer,
//   SubscribeMessage,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
//   OnGatewayInit,
//   ConnectedSocket,
//   MessageBody
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { Injectable, Logger } from '@nestjs/common';
// import { TicketsService } from './tickets.service';
// import { Types } from 'mongoose';

// interface UserSocket extends Socket {
//   userId?: string;
// }

// @WebSocketGateway({
//   cors: {
//     origin: '*', // Replace with your frontend URL in production
//   },
// })
// @Injectable()
// export class TicketsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
//   @WebSocketServer() server: Server;
//   private logger: Logger = new Logger('TicketsGateway');
//   private userSockets: Record<string, string> = {}; // userId -> socketId

//   constructor(
//     private readonly ticketsService: TicketsService
//   ) {}

//   afterInit(server: Server) {
//     this.logger.log('WebSocket Gateway initialized');
//   }

//   handleConnection(client: UserSocket, ...args: any[]) {
//     this.logger.log(`Client connected: ${client.id}`);
//   }

//   handleDisconnect(client: UserSocket) {
//     this.logger.log(`Client disconnected: ${client.id}`);
//     if (client.userId) {
//       delete this.userSockets[client.userId];
//     }
//   }

//   @SubscribeMessage('authenticate')
//   handleAuthenticate(
//     @ConnectedSocket() client: UserSocket,
//     @MessageBody() userId: string,
//   ) {
//     this.logger.log(`User ${userId} authenticated on socket ${client.id}`);
//     client.userId = userId;
//     this.userSockets[userId] = client.id;
    
//     // Join a personal room for direct messages
//     client.join(`user:${userId}`);
    
//     return { event: 'authenticated', data: { success: true } };
//   }

//   @SubscribeMessage('join_ticket_room')
//   handleJoinTicketRoom(
//     @ConnectedSocket() client: UserSocket,
//     @MessageBody() ticketId: string,
//   ) {
//     if (!client.userId) {
//       return { event: 'error', data: { message: 'Not authenticated' } };
//     }
    
//     // Join ticket-specific room
//     client.join(`ticket:${ticketId}`);
//     this.logger.log(`User ${client.userId} joined ticket room ${ticketId}`);
    
//     return { event: 'joined_ticket_room', data: { ticketId } };
//   }

//   @SubscribeMessage('leave_ticket_room')
//   handleLeaveTicketRoom(
//     @ConnectedSocket() client: UserSocket,
//     @MessageBody() ticketId: string,
//   ) {
//     client.leave(`ticket:${ticketId}`);
//     this.logger.log(`User ${client.userId} left ticket room ${ticketId}`);
    
//     return { event: 'left_ticket_room', data: { ticketId } };
//   }

//   @SubscribeMessage('create_ticket_draft')
//   async handleCreateTicketDraft(
//     @ConnectedSocket() client: UserSocket,
//     @MessageBody() data: {
//       counterpartyId: string;
//       amount: number;
//       Type: string; // Matches schema - "CASH" or "CARD"
//       Place: string;
//     },
//   ) {
//     if (!client.userId) {
//       return { event: 'error', data: { message: 'Not authenticated' } };
//     }
    
//     try {
//       // Generate a draft ticket ID
//       const draftId = new Types.ObjectId().toString();
      
//       // Notify the counterparty about the invitation
//       this.notifyUser(data.counterpartyId, 'ticket_invitation', {
//         draftId,
//         inviterId: client.userId,
//         amount: data.amount,
//         Type: data.Type, // Matches schema
//         Place: data.Place, // Matches schema
//         timestamp: new Date()
//       });
      
//       // Join the draft room
//       client.join(`draft:${draftId}`);
      
//       return { 
//         event: 'ticket_draft_created', 
//         data: { 
//           draftId,
//           success: true 
//         } 
//       };
//     } catch (error) {
//       this.logger.error(`Error creating ticket draft: ${error.message}`);
//       return { event: 'error', data: { message: error.message } };
//     }
//   }

//   @SubscribeMessage('accept_ticket_invitation')
//   handleAcceptInvitation(
//     @ConnectedSocket() client: UserSocket,
//     @MessageBody() draftId: string,
//   ) {
//     if (!client.userId) {
//       return { event: 'error', data: { message: 'Not authenticated' } };
//     }
    
//     // Join the draft room
//     client.join(`draft:${draftId}`);
    
//     // Notify room that user joined
//     this.server.to(`draft:${draftId}`).emit('user_joined_draft', {
//       userId: client.userId,
//       draftId
//     });
    
//     return { event: 'invitation_accepted', data: { draftId } };
//   }

//   @SubscribeMessage('update_draft_field')
//   handleUpdateDraftField(
//     @ConnectedSocket() client: UserSocket,
//     @MessageBody() data: { draftId: string; field: string; value: any },
//   ) {
//     if (!client.userId) {
//       return { event: 'error', data: { message: 'Not authenticated' } };
//     }
    
//     const { draftId, field, value } = data;
    
//     // Broadcast update to all users in the draft room except sender
//     client.to(`draft:${draftId}`).emit('draft_field_updated', {
//       field,
//       value,
//       updatedBy: client.userId
//     });
    
//     return { event: 'field_updated', data: { success: true } };
//   }

//   @SubscribeMessage('user_typing')
//   handleUserTyping(
//     @ConnectedSocket() client: UserSocket,
//     @MessageBody() draftId: string,
//   ) {
//     if (!client.userId) return;
    
//     client.to(`draft:${draftId}`).emit('counterparty_typing', {
//       userId: client.userId
//     });
//   }

//   @SubscribeMessage('finalize_ticket')
//   async handleFinalizeTicket(
//     @ConnectedSocket() client: UserSocket,
//     @MessageBody() data: {
//       draftId: string;
//       loaner: string;
//       loanee: string;
//       amount: number;
//       Type: string; 
//       Place: string;
//       Time?: Date;
//     },
//   ) {
//     if (!client.userId) {
//       return { event: 'error', data: { message: 'Not authenticated' } };
//     }
    
//     try {
//       const ticket = await this.ticketsService.createTicket({
//         loaner: data.loaner,
//         loanee: data.loanee,
//         amount: data.amount,
//         Type: data.Type,
//         Place: data.Place,
//         scheduledTime: data.Time || new Date(),
//         createTransaction: true
//       });
      
//       const ticketId = (ticket as any)._id.toString();
      
      
//       this.server.to(`draft:${data.draftId}`).emit('ticket_finalized', {
//         ticketId,
//         draftId: data.draftId,
//         ticket
//       });
      
//       // Notify individual users
//       this.notifyUser(data.loaner, 'ticket_created', {
//         ticketId,
//         role: 'loaner',
//         ticket
//       });
      
//       this.notifyUser(data.loanee, 'ticket_created', {
//         ticketId,
//         role: 'loanee',
//         ticket
//       });
      
//       return { 
//         event: 'ticket_created', 
//         data: { 
//           success: true,
//           ticketId
//         }
//       };
//     } catch (error) {
//       this.logger.error(`Error finalizing ticket: ${error.message}`);
//       return { event: 'error', data: { message: error.message } };
//     }
//   }

//   // Method to notify when a payment is processed
//   async notifyTicketPayment(ticketId: string, paymentType: string, status: string) {
//     try {
//       const ticket = await this.ticketsService.getTicketById(ticketId);
//       if (!ticket) {
//         this.logger.error(`Ticket not found: ${ticketId}`);
//         return;
//       }
      
//       // Notify both loaner and loanee - use type assertion for MongoDB ObjectId conversion
//       this.notifyUser((ticket as any).loaner.toString(), 'payment_update', {
//         ticketId,
//         status,
//         paymentType,
//         role: 'loaner'
//       });
      
//       this.notifyUser((ticket as any).loanee.toString(), 'payment_update', {
//         ticketId,
//         status,
//         paymentType,
//         role: 'loanee'
//       });
      
//       // Also broadcast to the ticket room
//       this.server.to(`ticket:${ticketId}`).emit('payment_updated', {
//         ticketId,
//         status,
//         paymentType,
//         updatedAt: new Date()
//       });
//     } catch (error) {
//       this.logger.error(`Error notifying payment: ${error.message}`);
//     }
//   }

//   // Helper method to notify a specific user
//   notifyUser(userId: string, type: string, data: any) {
//     const socketId = this.userSockets[userId];
    
//     if (socketId) {
//       this.server.to(socketId).emit('notification', {
//         type,
//         data,
//         timestamp: new Date()
//       });
//     } else {
//       // Don't try to store notification if not implemented in service
//       this.logger.log(`User ${userId} is offline, notification not delivered`);
//     }
//   }
// }
