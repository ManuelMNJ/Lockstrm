import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, FooterComponent],
  templateUrl: './public-layout.component.html',
  styleUrl:    './public-layout.component.css',
})
export class PublicLayoutComponent {}
