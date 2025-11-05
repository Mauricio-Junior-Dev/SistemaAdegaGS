import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-order-status-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-status-tracker.component.html',
  styleUrls: ['./order-status-tracker.component.css']
})
export class OrderStatusTrackerComponent {
  @Input() currentStatus: string = 'pending';
}

