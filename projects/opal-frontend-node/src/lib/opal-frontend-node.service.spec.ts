import { TestBed } from '@angular/core/testing';

import { OpalFrontendNodeService } from './opal-frontend-node.service';

describe('OpalFrontendNodeService', () => {
  let service: OpalFrontendNodeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OpalFrontendNodeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
