import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../../core/services/cart.service';
import { OrderService } from '../../../core/services/order.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class CheckoutComponent implements OnInit {
  checkoutForm: FormGroup;
  loading = false;
  paymentMethod: 'cash' | 'card' = 'cash';
  
  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private orderService: OrderService,
    private router: Router
  ) {
    this.checkoutForm = this.fb.group({
      delivery_address: ['', Validators.required],
      notes: [''],
      payment_method: ['cash', Validators.required]
    });
  }

  get cartItems$() {
    return this.cartService.cartItems$;
  }

  ngOnInit(): void {
    this.checkoutForm.get('payment_method')?.valueChanges.subscribe(method => {
      this.paymentMethod = method;
    });
  }

  async onSubmit(): Promise<void> {
    if (this.checkoutForm.invalid) return;

    this.loading = true;

    try {
      // Obter itens do carrinho
      const cartItems = await firstValueFrom(this.cartItems$);
      
      // Criar pedido
      const orderData = {
        items: cartItems.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        })),
        total_amount: this.cartService.getTotal(),
        type: 'online',
        notes: this.checkoutForm.get('notes')?.value,
        payment_method: this.paymentMethod === 'card' ? 'cartão de crédito' : 'dinheiro'
      };

      const order = await firstValueFrom(this.orderService.createOrder(orderData));

      if (order) {
        this.router.navigate(['/loja/pedido', order.id]);
        this.cartService.clearCart();
      }

    } catch (error) {
      console.error('Erro ao processar pedido:', error);
      // Implementar tratamento de erro
    } finally {
      this.loading = false;
    }
  }

  getTotal(): number {
    return this.cartService.getTotal();
  }
}