import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const ReusableTooltip = ({ children, message, placement = 'right' }) => (
  <OverlayTrigger
    placement={placement}
    overlay={<Tooltip>{message}</Tooltip>}
  >
    <span>{children}</span>
  </OverlayTrigger>
);

// 사용 예시
// <ReusableTooltip message="재고가 부족합니다">
//   <span style={{ color: 'red' }}>{p.allocated_quantity || 0} / {requiredQty}</span>
// </ReusableTooltip>

export default ReusableTooltip;