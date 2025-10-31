<ListGroup variant="flush">
                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>부품명</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.part_name || ""}
                      onChange={(e) => onChangeField("part_name", e.target.value)}
                      style={{ maxWidth: "200px" }}
                    />
                  ) : (
                    <span>{part.part_name || "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>보관 위치</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.location || ""}
                      onChange={(e) => onChangeField("location", e.target.value)}
                      style={{ maxWidth: "200px" }}
                    />
                  ) : (
                    <Badge bg="primary" className="me-1">{part.location || "-"}</Badge>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>패키지</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.package || ""}
                      onChange={(e) => onChangeField("package", e.target.value)}
                      style={{ maxWidth: "200px" }}
                    />
                  ) : (
                    <span>{part.package || "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>가격</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="number"
                      value={editedPart.price || ""}
                      onChange={(e) => onChangeField("price", e.target.value)}
                      style={{ maxWidth: "120px" }}
                    />
                  ) : (
                    <span>{part.price ? `${part.price}원` : "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>수량</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="number"
                      value={editedPart.quantity || ""}
                      onChange={(e) => onChangeField("quantity", e.target.value)}
                      style={{ maxWidth: "100px" }}
                    />
                  ) : (
                    <span>{part.quantity ?? "-"}</span>
                  )}
                </ListGroup.Item>

                <ListGroup.Item className="d-flex justify-content-between align-items-center px-0">
                  <strong>구매 링크</strong>
                  {isEditing ? (
                    <Form.Control
                      size="sm"
                      type="text"
                      value={editedPart.purchase_url || ""}
                      onChange={(e) => onChangeField("purchase_url", e.target.value)}
                      style={{ maxWidth: "300px" }}
                    />
                  ) : (
                    part.purchase_url ? (
                      <a href={part.purchase_url} target="_blank" rel="noopener noreferrer">
                        {part.purchase_url}
                      </a>
                    ) : (
                      <span>-</span>
                    )
                  )}
                </ListGroup.Item>
              </ListGroup>