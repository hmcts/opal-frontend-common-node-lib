import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpalFrontendNodeComponent } from './opal-frontend-node.component';

describe('OpalFrontendNodeComponent', () => {
  let component: OpalFrontendNodeComponent;
  let fixture: ComponentFixture<OpalFrontendNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpalFrontendNodeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OpalFrontendNodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
