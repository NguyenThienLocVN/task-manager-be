# Tích hợp frontend: Văn bản đến và Văn bản đi

Tài liệu này mô tả cách frontend gọi API văn bản để hiển thị hai hộp thư theo người dùng đang đăng nhập.

## 1. Khái niệm nghiệp vụ

- **Văn bản đến**: văn bản được phân công cho người dùng hoặc phòng ban của người dùng. Khi cán bộ trình công việc để duyệt, văn bản chuyển vào hộp thư đến của người giao/người tạo công việc để xử lý.
- **Văn bản đi**: văn bản gắn với công việc do người dùng tạo hoặc giao, hoặc văn bản người dùng đã trình duyệt.
- Hộp thư được xác định từ người dùng trong access token, tổ chức, tuyến phân công và lịch sử trình duyệt. Frontend không truyền `userId` để chọn hộp thư.
- Văn bản cần liên kết với công việc qua `documentId` để tham gia luồng phân công/trình duyệt. Văn bản không gắn công việc chỉ được tính là văn bản đến nếu có `receivedBy`.

## 2. Cấu hình gọi API

Mặc định ở local:

```text
API base URL: http://localhost:3001/api
```

Các API văn bản yêu cầu access token:

```http
Authorization: Bearer <access_token>
```

Khi access token hết hạn hoặc phiên không hợp lệ, xử lý `401` theo luồng đăng nhập lại hiện có của ứng dụng.

## 3. API hộp thư

### Văn bản đến

```http
GET /api/documents/inbox?page=1&limit=20
```

### Văn bản đi

```http
GET /api/documents/outbox?page=1&limit=20
```

### API danh sách dùng chung

```http
GET /api/documents?direction=INCOMING&page=1&limit=20
GET /api/documents?direction=OUTGOING&page=1&limit=20
```

Nếu bỏ `direction`, API mặc định trả về văn bản đến. Có thể dùng hai endpoint `/inbox` và `/outbox` cho hai tab để tránh phải tự quản lý giá trị này ở frontend.

### API hỗ trợ màn hình

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/api/document-fields` | Lấy danh sách lĩnh vực đang hoạt động để làm bộ lọc |
| `GET` | `/api/documents/statistics/by-field` | Lấy thống kê số văn bản theo lĩnh vực |
| `GET` | `/api/documents/{id}` | Lấy chi tiết văn bản |
| `POST` | `/api/documents` | Tạo văn bản; có thể gửi file |
| `PATCH` | `/api/documents/{id}` | Cập nhật thông tin văn bản |
| `POST` | `/api/documents/{id}/file` | Thay file đính kèm |
| `DELETE` | `/api/documents/{id}` | Xóa văn bản |

### Bộ lọc và phân trang

Các tham số có thể kết hợp:

| Tham số | Kiểu | Ý nghĩa |
|---|---|---|
| `page` | số nguyên, mặc định `1` | Trang bắt đầu từ 1 |
| `limit` | số nguyên từ 1 đến 100, mặc định `20` | Số bản ghi mỗi trang |
| `search` | chuỗi | Tìm theo tiêu đề, số văn bản hoặc cơ quan ban hành |
| `status` | enum | Lọc trạng thái văn bản |
| `fieldId` | UUID | Lọc lĩnh vực |
| `direction` | `INCOMING` hoặc `OUTGOING` | Chiều văn bản; mặc định `INCOMING` |

Giá trị `status`:

```text
RECEIVED, CLASSIFIED, ASSIGNED, PROCESSING, COMPLETED, ARCHIVED
```

Ví dụ:

```http
GET /api/documents/inbox?search=kế%20hoạch&status=ASSIGNED&page=1&limit=10
```

### Dữ liệu trả về

API danh sách trả về:

```json
{
  "items": [
    {
      "id": "document-uuid",
      "documentNo": "Số văn bản",
      "documentDate": "2026-11-03",
      "title": "Tiêu đề văn bản",
      "documentType": "Công văn",
      "issuingAgency": "Cơ quan ban hành",
      "receivedDate": "2026-11-03",
      "fileUrl": "/api/documents/document-uuid/file",
      "receivedBy": "user-uuid",
      "fieldId": "field-uuid",
      "status": "ASSIGNED",
      "fileName": "van-ban.pdf",
      "mimeType": "application/pdf",
      "fileSize": "123456",
      "createdAt": "2026-11-03T01:00:00.000Z",
      "updatedAt": "2026-11-03T01:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

Các trường chưa có dữ liệu có thể là `null`. `fileSize` được trả về dạng chuỗi. Response hiện không có trường `direction`; frontend xác định chiều theo tab/endpoint vừa gọi.

## 4. Luồng công việc liên quan

### Lãnh đạo giao văn bản cho cán bộ/phòng ban

1. Tạo văn bản qua `POST /api/documents` (có thể gửi file dạng multipart).
2. Tạo công việc có `documentId` bằng ID văn bản vừa tạo.
3. Giao công việc qua `POST /api/tasks/{taskId}/route`.
   - Giao trực tiếp: `routeType: "DIRECT"`, có `assigneeId`.
   - Giao cho phòng ban: `routeType: "DEPARTMENT"`, không gửi `assigneeId`.
4. Văn bản được tính vào văn bản đi của người tạo/giao và văn bản đến của người nhận tương ứng.

Ví dụ body tạo công việc:

```json
{
  "title": "Xử lý văn bản",
  "organizationId": "organization-uuid",
  "documentId": "document-uuid"
}
```

Ví dụ giao trực tiếp:

```json
{
  "routeType": "DIRECT",
  "departmentId": "department-uuid",
  "assigneeId": "user-uuid",
  "note": "Vui lòng xử lý"
}
```

### Cán bộ trình văn bản cho lãnh đạo duyệt

Gọi:

```http
POST /api/tasks/{taskId}/submit-review
```

Body có thể truyền kết quả xử lý:

```json
{
  "result": "Nội dung trình lãnh đạo xem xét"
}
```

Khi công việc chuyển sang `PENDING_REVIEW`, văn bản được tính vào văn bản đi của người trình và văn bản đến của người tạo/người giao công việc.

## 5. Mở và tải file

Các endpoint trả về nội dung file nhị phân, không phải JSON:

```http
GET /api/documents/{id}/file       # Xem trước
GET /api/documents/{id}/download   # Tải xuống
```

Do endpoint cần `Authorization`, nên khi dùng trình duyệt frontend nên tải file bằng `fetch` kèm bearer token rồi mở/tải `Blob`; không nên gán trực tiếp `fileUrl` vào `<iframe>` nếu không có cơ chế gửi header xác thực.

Ví dụ:

```ts
async function openDocumentFile(id: string, accessToken: string) {
  // Mở cửa sổ đồng bộ với thao tác người dùng để tránh popup blocker.
  const previewWindow = window.open('about:blank', '_blank');
  if (!previewWindow) {
    throw new Error('Trình duyệt đã chặn cửa sổ xem trước văn bản');
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/documents/${id}/file`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(`Không thể mở văn bản (${response.status})`);
    }

    const blobUrl = URL.createObjectURL(await response.blob());
    previewWindow.location.href = blobUrl;
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}
```

## 6. Gợi ý triển khai giao diện

- Dùng hai tab **Văn bản đến** và **Văn bản đi**, mỗi tab gọi endpoint tương ứng.
- Khi đổi trang, tìm kiếm hoặc bộ lọc, gửi lại `page`, `limit` và các bộ lọc đang chọn; dùng `totalPages` để dựng phân trang.
- Hiển thị trạng thái văn bản từ trường `status`. Trạng thái công việc/trình duyệt là dữ liệu riêng; nếu cần hiển thị chi tiết luồng xử lý, gọi API công việc theo quyền người dùng, không suy luận trạng thái duyệt từ `document.status`.
- Khi tạo công việc cho văn bản, luôn truyền `documentId`; nếu không có liên kết này, văn bản không xuất hiện trong hộp thư theo luồng công việc.
- Xử lý response rỗng (`items: []`) như trường hợp bình thường khi người dùng chưa có văn bản phù hợp.
